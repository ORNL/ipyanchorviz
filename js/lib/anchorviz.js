import * as d3 from "d3";
import * as d3Lasso from "d3-lasso";
import * as _ from "lodash";
import * as math from "./math.js";
import * as utils from "./utils.js";

require('./style.css')

/**
 * Makes a clone of the anchors, this is done because the model won't
 * register changes if the set modified is the set contained in the model.
 * (There's no "diff.")
 * */
function getModifiableAnchors(that) {
  return _.cloneDeep(that.model.get("anchors"));
}

/** Replace the anchors on the model _from within js_. */
function setAnchors(that, anchors) {
  that.model.set("anchors", _.cloneDeep(anchors));
  that.touch();
  that.localAnchors = _.cloneDeep(anchors);
}

// Called from py-js bridge.
export function updateSelectedDataPointID(that) {
  that.svg.selectAll(".datapoint")
    .classed("selected-point", (d) => d.id === that.model.get("selectedDataPointID"))
}

// Called from py-js bridge.
export function updateSelectedAnchorID(that) {
  that.svg.selectAll(".anchor")
    .classed("anchor-selected", false)
  that.svg.select("#anchor-" + that.model.get("selectedAnchorID").toString())
    .classed("anchor-selected", true)
}

/** Data update called from the py-js bridge. */
export function updateData(that) {
  that.enterDatapoints();
  that.animateDatapoints();
}

/** Anchors update called from the py-js bridge. */
export function updateAnchors(that) {
  let anchorsPrev = that.model.previous("anchors");
  let anchors = getModifiableAnchors(that);

  let newAnchorFound = false;

  for (let anchor of anchors) {
    // either the anchor (id) is in the previous list or not
    if (utils.anchorInList(anchor, anchorsPrev)) {
      // edit existing anchor
      console.log("Updating " + anchor.id.toString());
      that.updateVizAnchorAttrs(anchor);
      that.updateAnchorDisplayPos(anchor);
    }
    else {
      // add the new anchor
      newAnchorFound = true;
      console.log("Adding from update " + anchor.id.toString());
      that.addVizAnchor(anchor);
      updateData(that);
    }
  }

  // check for deleted anchors
  let deletedAnchorFound = false;
  for (let anchor of anchorsPrev) {
    if (!utils.anchorInList(anchor, anchors)) {
      deletedAnchorFound = true;
      console.log("Removing " + anchor.id.toString());
      that.svg.select("#anchor-" + anchor.id.toString()).remove();
      that.svg.select("#anchor-text-" + anchor.id.toString()).remove();
    }
  }
  that.localAnchors = anchors;
  if (deletedAnchorFound) {
    console.log("updating data")
    //that.localAnchors = anchors;
    updateData(that);
  }
  else if (!newAnchorFound) {
    //that.localAnchors = anchors;
    that.updateDataPointPositionsImmediate();
  }
  //that.localAnchors = anchors;
  //updateData(that);
};

// Called from py-js bridge
export function updateLassoedPoints(that) {
  let lassoedIDs = that.model.get("lassoedPointIDs");
  that.svg.selectAll(".datapoint")
    .classed("lassoed-point", (d) => (lassoedIDs.includes(d.id)))
}

/** Initialize the d3 viz. */
export function create(that) {

  // ==================================================
  // ATTRIBUTES
  // ==================================================
  let radius = that.model.get("radius");
  let margin = that.model.get("margin");
  let focusIndicatorActionDistance = that.model.get("focusIndicatorActionDistance");
  let anchorSize = that.model.get("anchorSize");
  that.defaultAnchorColor = "grey";

  // ==================================================
  // LOCAL STATE
  // ==================================================
  // This is here rather than the model because we only ever need to reference
  // it inside of this create function.
  let focusIndicator;

  // ==================================================
  // STATE FLAGS
  // ==================================================
  that.focusIndicatorActionInRange = false;
  that.focusIndicatorOverAnchor = false;
  that.anchorDragging = false;
  that.hoveringOverPoint = false;

  // Keep track of an anchor's theta before starting to drag,
  // if it's not actually moved, don't raise an event.
  // let draggingAnchorPrevTheta;
  that.draggingAnchorPrevTheta = 0.0;


  let init = function () {

    that.localAnchors = [];

    // NOTE: must use createElementNS for svg elems because
    // https://stackoverflow.com/questions/56659218/fix-broken-display-of-svg-using-ipywidgets-domwidget-in-jupyter-notebook
    let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    that.el.appendChild(svgElement);
    that.el.setAttribute('class', 'jupyter-widget anchorviz');

    that.width = radius * 2 + margin.left + margin.right;
    that.height = radius * 2 + margin.top + margin.bottom;

    that.svg = d3.select(svgElement);
    that.svg.attr("width", that.width).attr("height", that.height);

    that.ring = that.svg.append("circle")
      .attr("class", "ring")
      .attr("r", radius)
      .attr("cx", radius + margin.left)
      .attr("cy", radius + margin.top);

    focusIndicator = that.svg.append("g")
      .attr("class", "ring-focus-indicator");
    focusIndicator.append("circle").attr("r", that.model.get("focusIndicatorSize"));

    that.overlay = that.svg.append("rect")
      .attr("class", "click-overlay")
      .attr("width", that.width).attr("height", that.height)
      .on("mousemove", overlayMouseMove)
      .on("click", function () { overlayClick(that) });


    // handle any starting anchors
    for (let anchor of getModifiableAnchors(that)) {
      that.addVizAnchor(anchor);
    }

    that.enterDatapoints();
    that.animateDatapoints();
  }

  // ==================================================
  // BASIC MATH
  // ==================================================

  let calculateDatapointPosition = function (point) {
    let anchors = that.localAnchors;
    // we do this because localAnchors is effected throughout a drag,
    // whereas the actual anchors are only updated at drag end.
    let radius = that.model.get("radius");
    let ringInnerPadding = that.model.get("ringInnerPadding");

    let x = 0.0;
    let y = 0.0;
    let maxPointRadius = radius - ringInnerPadding;

    // We have to renormalize points if one of the anchors isn't visible, or
    // if user has requested to always normalize
    let retriggerNorm = that.model.get("autoNorm");

    if (point.weights !== undefined)
    {

      function visible(anchor) {
        if (anchor.visible === undefined) {
          return true;
        }
        return anchor.visible;
      }

      for (let anchor of anchors) {
        if (!visible(anchor)) {
          // if an anchor that's influencing a point isn't being shown,
          // then the weight associated with it is "unused" and therefore
          // the point is not correctly being shown as normalized. We
          // must recompute the weights to acccount for renormalization.
          if (point.weights[anchor.id] > 0) {
            retriggerNorm = true;
            break;
          } else {
            continue;
          }
        }
        if (anchor.id in point.weights) {
          let value = point.weights[anchor.id];
          let [vX, vY] = math.polarToRect(that, maxPointRadius, anchor.theta, false);
          x += vX * value;
          y += vY * value;
        }
      }

      // redistribute normalized weights among visible anchors, adjusting
      // resulting x/y
      if (retriggerNorm) {
        x = 0.0;
        y = 0.0;

        // figure out the total "distance" to normalize by
        let sum = 0.0;

        for (let anchor of anchors) {
          if (visible(anchor) && anchor.id in point.weights) {
            sum += point.weights[anchor.id];
          }
        }

        // apply the norm per-anchor and re-adjust the result x/y
        if (sum > 0.0) {
          for (let anchor of anchors) {
            if (!visible(anchor)) {
              continue;
            }
            if (anchor.id in point.weights) {
              let value = point.weights[anchor.id] / sum; // renorm here
              let [vX, vY] = math.polarToRect(
                that,
                maxPointRadius,
                anchor.theta,
                false
              );
              x += vX * value;
              y += vY * value;
            }
          }
        }
      }
    }

    let noise = that.getNoise(that, point);
    x += noise[0];
    y += noise[1];

    return [x, y];
  }

  // ==================================================
  // EVENT HANDLERS
  // ==================================================
  let overlayMouseMove = function () {
    let [x, y] = d3.mouse(that.overlay.node());
    let r = math.getMouseRadius(that, x, y);

    // determine if mouse within range of taking an action, and indicate to
    // user.
    let distFromRing = Math.abs(r - radius);
    that.focusIndicatorActionInRange =
      distFromRing < focusIndicatorActionDistance;
    focusIndicator.classed("ring-focus-indicator-action-possible", that.focusIndicatorActionInRange);

    let theta = math.getMouseTheta(that, x, y);
    let newPointCoords = math.polarToRect(that, radius, theta, true); // radius instead of r because we want it to appear on outer edge of ring
    focusIndicator.attr(
      "transform",
      `translate(${newPointCoords[0]}, ${newPointCoords[1]})`
    );
  }

  let overlayClick = function () {
    if (that.focusIndicatorActionInRange) {
      let [x, y] = d3.mouse(that.overlay.node());
      let theta = math.getMouseTheta(that, x, y);

      let oldAnchors = that.model.get("anchors"); // TODO: unclear if this will work, may need getModifiableAnchors
      let newAnchor = {
        id: (parseInt(utils.maxAnchorID(oldAnchors)) + 1).toString(),
        theta: theta,
        name: "New Anchor"
      };
      let anchors = [...oldAnchors, newAnchor];
      //console.log("Adding from overlay click " + newAnchor.id);
      //that.addVizAnchor(newAnchor); // we don't need this because the below
      //setAnchors call takes care of it

      setAnchors(that, anchors);  // NOTE: this triggers the updateAnchors
      that.model.send({ 'type': 'anchor_add', "theta": theta, "newAnchor": newAnchor });
    }
  }

  // ---- LASSO ---------------------------------------

  function lassoStart() {
    if (
      that.focusIndicatorOverAnchor ||
      that.focusIndicatorActionInRange ||
      that.hoveringOverPoint
    ) {
      return;
    }
    that.lasso
      .items()
      .classed("within-current-lasso-selection", false)
      .classed("lassoed-point", false);
  }
  function lassoDraw() {
    if (
      that.focusIndicatorOverAnchor ||
      that.focusIndicatorActionInRange ||
      that.hoveringOverPoint
    ) {
      return;
    }
    // NOTE: previously used as a separate lassoStart handler, but kept
    // having issues like trying to lasso when selecting a point and things
    // like that. So I want to ensure we're not directly over a point
    that.lasso.possibleItems().classed("within-current-lasso-selection", true);
    that.lasso
      .notPossibleItems()
      .classed("within-current-lasso-selection", false);
  }
  function lassoEnd() {
    if (
      that.focusIndicatorOverAnchor ||
      that.focusIndicatorActionInRange ||
      that.hoveringOverPoint
    ) {
      return;
    }
    that.lasso.items().classed("within-current-lasso-selection", false);

    let lassoedPointIDs = []

    that.lasso.selectedItems().each((d) => {
      lassoedPointIDs = [...lassoedPointIDs, d.id];
    });
    that.model.set("lassoedPointIDs", lassoedPointIDs);
    that.touch();
    that.model.send({ "type": "lasso_change", "pointIDs": lassoedPointIDs });
  }
  let refreshLasso = function () {
    let data = that.model.get("data");
    let localDatapoints = that.svg.selectAll(".datapoint").data(data);
    that.lasso = d3Lasso
      .lasso()
      .closePathSelect(true)
      .closePathDistance(100)
      .items(localDatapoints)
      .targetArea(that.svg)
      .on("start", lassoStart)
      .on("draw", lassoDraw)
      .on("end", lassoEnd);
    that.svg.call(that.lasso);
  }

  // ---- DRAG HANDLING -------------------------------

  let anchorDragStart = function (anchor) {
    that.anchorDragging = true;
    that.draggingAnchorPrevTheta = anchor.theta;

    that.svg.select("#anchor-" + anchor.id.toString())
      .classed("anchor-dragging", true)
    focusIndicator.classed("ring-focus-indicator-active", true)
  }
  let anchorDragEnd = function (anchor) {
    that.anchorDragging = false;

    let anchors = getModifiableAnchors(that);
    utils.anchorByIndex(anchor.id, anchors).theta = anchor.theta

    that.svg.select("#anchor-" + anchor.id.toString())
      .classed("anchor-dragging", false)
    focusIndicator.classed("ring-focus-indicator-active", false)

    // we only dispatch if theta has actually changed.
    if (anchor.theta !== that.draggingAnchorPrevTheta) {
      setAnchors(that, anchors);
      that.model.send({ "type": "anchor_drag", "theta": anchor.theta, "id": anchor.id });
    }
  }
  let anchorDrag = function (anchor) {
    let mouseLoc = d3.mouse(that.overlay.node());
    let newTheta = math.getMouseTheta(that, mouseLoc[0], mouseLoc[1]);
    anchor.theta = newTheta;
    that.localAnchors[utils.anchorIndexByID(anchor.id, that.localAnchors)].theta = newTheta;

    that.updateAnchorDisplayPos(anchor);
    that.updateDataPointPositionsImmediate();
    overlayMouseMove();
  }

  that.addVizAnchor = function (anchorData) {
    that.localAnchors.push(_.cloneDeep(anchorData));
    that.svg.append("circle")
      .attr("id", "anchor-" + anchorData.id.toString())
      .classed("anchor", true)
      .attr("r", anchorSize)
      .on("mouseover", () => focusIndicator.classed("ring-focus-indicator-anchor-hover", true))
      .on("mouseout", () => focusIndicator.classed("ring-focus-indicator-anchor-hover", false))
      .on("mousemove", () => that.overlay.node().dispatchEvent(new MouseEvent(d3.event.type, d3.event)))
      .on("click", () => {
        // TODO: deselect old anchor (should this functionality just be based on
        // change: of selected anchor id? Will that work if the change is
        // triggered from here?
        let selectedAnchorID = that.model.get("selectedAnchorID");
        if (selectedAnchorID != "") {
          that.svg.select("#anchor-" + selectedAnchorID).classed("anchor-selected", false);
        }
        selectedAnchorID = anchorData.id;
        that.svg.select("#anchor-" + selectedAnchorID).classed("anchor-selected", true);
        that.model.set("selectedAnchorID", selectedAnchorID);
        that.touch();
      })
      .call(
        d3.drag()
          .on("start", () => anchorDragStart(anchorData))
          .on("drag", () => anchorDrag(anchorData))
          .on("end", () => anchorDragEnd(anchorData))
      );

    that.svg.append("text")
      .classed("anchor-label", true)
      .attr("id", "anchor-text-" + anchorData.id.toString())
    //.text(anchorData.name)

    that.updateVizAnchorAttrs(anchorData);
    that.updateAnchorDisplayPos(anchorData);
  }

  that.updateVizAnchorAttrs = function (anchor) {
    let anchorSVG = that.svg.select("#anchor-" + anchor.id.toString());
    let anchorLabelSVG = that.svg.select("#anchor-text-" + anchor.id.toString());

    if (anchor.color !== undefined) { anchorSVG.style("fill", anchor.color) }
    else { anchorSVG.style("fill", null) }
    // NOTE: can't use fill attribute when the stylesheet is setting the fill style
    // (local attribute doesn't override - local _style_ does.)
    //anchorSVG.attr("fill", () => anchor.color === undefined ? that.defaultAnchorColor : anchor.color)
    anchorLabelSVG.text(anchor.name);
  }

  that.updateAnchorDisplayPos = function (anchor) {
    radius = that.model.get("radius");
    let point = math.polarToRect(that, radius, anchor.theta, true);
    let labelPoint = math.polarToRect(that, radius + focusIndicatorActionDistance, anchor.theta, true)

    let anchorSVG = that.svg.select("#anchor-" + anchor.id.toString());
    let anchorLabelSVG = that.svg.select("#anchor-text-" + anchor.id.toString());

    anchorSVG.attr("cx", point[0]).attr("cy", point[1]);
    anchorLabelSVG.attr("x", labelPoint[0]).attr("y", labelPoint[1])
      .attr("text-anchor", utils.getTextAnchorFromTheta(anchor.theta));
  }

  // used for mouse dragging/non animated updates
  that.updateDataPointPositionsImmediate = function () {
    radius = that.model.get("radius");
    margin = that.model.get("margin");
    that.svg.selectAll(".datapoint")
      .attr(
        "cx",
        (d) =>
          calculateDatapointPosition(d)[0] +
          radius +
          margin.left
      )
      .attr(
        "cy",
        (d) =>
          calculateDatapointPosition(d)[1] +
          radius +
          margin.top
      );
  }

  // Store random x/y noise values for each index. We create it only once
  // for each index so we don't get "jitter" on every update.
  that.getNoise = function (that, d) {
    if (that.noise === undefined) {
      that.noise = {}
    }

    // if we already made noise for this index, grab it.
    if (d.id in that.noise) {
      return that.noise[d.id];
    }

    // compute noise
    let mag = that.model.get("noiseMagnitude");
    let x = Math.random() * mag - (mag / 2);
    let y = Math.random() * mag - (mag / 2);

    that.noise[d.id] = [x, y];
    return [x, y];
  }


  that.enterDatapoints = function () {
    let datapoints_data = that.model.get("data");
    let radius = that.model.get("radius");
    let margin = that.model.get("margin");
    let pointSize = that.model.get("pointSize");

    let datapoints = that.svg
      .selectAll(".datapoint")
      .data(datapoints_data, (d) => d.id.toString());

    datapoints
      .enter()
      .append("circle")
      .classed("datapoint", true)
      .attr("cx", function () { return radius + margin.left; })
      .attr("cy", function () { return radius + margin.top; })
      .attr("r", pointSize)
      .attr("fill", (d) => d.color === undefined ? "green" : d.color)
      .classed("labeled-point", (d) => d.labeled === undefined ? false : d.labeled)
      .on("mouseover", (d) => {
        that.model.set("selectedDataPointID", d.id.toString());
        that.touch();
        that.model.send({ "type": "point_hover", "pointID": d.id });
      })
      .on("mousemove", () =>
        that.overlay
          .node()
          .dispatchEvent(new MouseEvent(d3.event.type, d3.event))
      );

    datapoints.exit().remove();
    refreshLasso();
  }

  that.animateDatapoints = function () {
    let radius = that.model.get("radius");
    let margin = that.model.get("margin");

    let datapoints_data = that.model.get("data");
    let datapoints = that.svg
      .selectAll(".datapoint")
      .data(datapoints_data, (d) => d.id.toString());

    datapoints.style("visibility", "visible");

    function visible(point) {
      if (point.visible === undefined) {
        return true;
      }
      return point.visible;
    }

    datapoints
      .transition()
      .duration(that.model.get("animationTime")) // TODO - make configurable
      .attr(
        "cx",
        (d) =>
          calculateDatapointPosition(d)[0] +
          radius +
          margin.left
      )
      .attr(
        "cy",
        (d) =>
          calculateDatapointPosition(d)[1] +
          radius +
          margin.top
      )
      .style("fill", (d) => d.color)
      .style("opacity", (d) => {
        if (visible(d)) {
          return 1;
        }
        else {
          return 0;
        }
      })
      .on("end", () => {
        this.svg.selectAll(".datapoint").style("visibility", (d) => {
          if (visible(d)) {
            return "visible";
          }
          else {
            return "hidden";
          }
        });
      });

    datapoints.classed("labeled-point", (d) => d.labeled === undefined ? false : d.labeled);
  }

  init();
};



// module.exports = {
//   create,
//   updateAnchors,
//   updateLassoedPoints,
//   updateSelectedDataPointID,
//   updateSelectedAnchorID,
//   updateData
// }
