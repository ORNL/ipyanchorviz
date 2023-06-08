/** Convert between coordinate systems (theta, magnitude to x,y.) */
export function polarToRect(
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
export function adjustMouseCoords(that, x, y) {
  let radius = that.model.get("radius");
  let margin = that.model.get("margin");
  x -= radius + margin.left;
  y -= radius + margin.top;
  return [x, y];
}

/** Gets the distance of the mouse from the center of the ring (for polar coords.) */
export function getMouseRadius(that, x, y) {
  [x, y] = adjustMouseCoords(that, x, y);
  return Math.sqrt(x * x + y * y);
}

/** Gets the angle of the mouse wrt the center of the ring (for polar coords.) */
export function getMouseTheta(that, x, y) {
  [x, y] = adjustMouseCoords(that, x, y);
  let theta = Math.atan(y / x);
  if (x < 0) {
    theta += Math.PI;
  }
  return theta;
}
