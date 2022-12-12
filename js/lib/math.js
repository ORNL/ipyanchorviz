/** Convert between coordinate systems (theta, magnitude to x,y.) */
let polarToRect = function (
  that,
  r,
  theta,
  adjust = false
) {
  let radius = that.model.get("radius");
  let margin = that.model.get("margin");

  let x = r * Math.cos(theta);
  let y = r * Math.sin(theta);
  // essentially reversing a prior adjustMouseCoords call I think
  if (adjust) {
    x += radius + margin.left;
    y += radius + margin.top;
  }
  return [x, y];
}

/** Provides the mouse coordinates relative to the center of the ring. */
let adjustMouseCoords = function (that, x, y) {
  let radius = that.model.get("radius");
  let margin = that.model.get("margin");
  x -= radius + margin.left;
  y -= radius + margin.top;
  return [x, y];
}

/** Gets the distance of the mouse from the center of the ring (for polar coords.) */
let getMouseRadius = function (that, x, y) {
  [x, y] = adjustMouseCoords(that, x, y);
  return Math.sqrt(x * x + y * y);
}

/** Gets the angle of the mouse wrt the center of the ring (for polar coords.) */
let getMouseTheta = function (that, x, y) {
  [x, y] = adjustMouseCoords(that, x, y);
  let theta = Math.atan(y / x);
  if (x < 0) {
    theta += Math.PI;
  }
  return theta;
}

module.exports = {
  polarToRect,
  adjustMouseCoords,
  getMouseRadius,
  getMouseTheta
}
