/**
 * The bridge between the python anchorviz widget and the
 * javascript frontend.
*/

let widgets = require('@jupyter-widgets/base');
let _ = require('lodash');
let anchorviz = require('./anchorviz.js');

let AnchorVizModel = widgets.DOMWidgetModel.extend({
  defaults: _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
    _model_name: 'AnchorVizModel',
    _view_name: 'AnchorVizView',
    _model_module: 'ipyanchorviz',
    _view_module: 'ipyanchorviz',
    _model_module_version: '0.1.0',
    _view_module_version: '0.1.0',

    /* bi-directional things */
    anchors: [],
    selectedAnchorID: "",
    data: [],
    selectedDataPointID: "",
    lassoedPointIDs: [],

    /* configuration */
    margin: { left: 80, right: 80, top: 30, bottom: 30 },
    radius: 275,
    /** The minimum amount of padding between the ring border and any contained points. */
    ringInnerPadding: 35,
    anchorTextOffset: 20,
    pointSize: 2.0,
    anchorSize: 6.0,
    focusIndicatorSize: 8.5,
    /** Cursor distance from the ring to allow ring click action. */
    focusIndicatorActionDistance: 20,
    /**
     * Whether to automatically normalize the weights of points, leave false if
     * normalization is already being handled elsewhere.
     */
    autoNorm: false,
    /** How much noise to add to each point so they're offset/visible. */
    noiseMagnitude: 15,
    /** Duration of animation effects on update. */
    animationTime: 2000,
  })
});

var AnchorVizView = widgets.DOMWidgetView.extend({
  render: function () {
    anchorviz.create(this);
    this.model.on("change:anchors", this.anchorsChange, this);
    this.model.on("change:selectedAnchorID", this.selectedAnchorChange, this);

    this.model.on("change:data", this.dataChange, this);
    this.model.on("change:selectedDataPointID", this.selectedDataPointChange, this);
    this.model.on("change:lassoedPointIDs", this.lassoedPointsChange, this);
  },

  anchorsChange: function () { anchorviz.updateAnchors(this); },
  selectedAnchorChange: function () { anchorviz.updateSelectedAnchorID(this); },

  dataChange: function () { anchorviz.updateData(this); },
  selectedDataPointChange: function () { anchorviz.updateSelectedDataPointID(this); },
  lassoedPointsChange: function () { anchorviz.updateLassoedPoints(this); },
});

module.exports = {
  AnchorVizModel: AnchorVizModel,
  AnchorVizView: AnchorVizView
}
