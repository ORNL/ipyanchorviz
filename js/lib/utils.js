/** Calculates best text anchor to keep anchor label text out of ring. */
export function getTextAnchorFromTheta(theta) {
  if (
    (theta > Math.PI / 4 && theta < (3 * Math.PI) / 4) ||
    (theta > (5 * Math.PI) / 4 && theta < (7 * Math.PI) / 4)
  ) {
    return "middle";
  } else if (theta < Math.PI / 4 || theta > (7 * Math.PI) / 4) {
    return "start";
  } else if (theta < (5 * Math.PI) / 4 && theta > (3 * Math.PI) / 4) {
    return "end";
  }

  return "ERROR";
}

/** Get the list index of the anchor with the specified ID, or -1 if not found. */
export function anchorIndexByID(id, list) {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) { return i; }
  }
  return -1;
}

/** Returns true if it finds the anchor (by id) in the given list of anchors. */
export function anchorInList(anchor, list) {
  let index = anchorIndexByID(anchor.id, list);

  if (index === -1) { return false; }
  return true;
}

/**
 * Returns the anchor data associated with the given index in the given list,
 * this is just a shortcut to not have to have this particular loop strewn
 * everywhere in the code.
*/
export function anchorByIndex(id, list) {
  for (let listAnchor of list) {
    if (listAnchor.id === id) { return listAnchor; }
  }
  return null;
}

/** Returns the highest ID number in the given list. */
// NOTE: this means that id's are always assumed to be numerical
export function maxAnchorID(list) {
  if (list.length === 0) { return -1; }
  let max = parseInt(list[0].id);
  for (let anchor of list) {
    if (parseInt(anchor.id) > max) {
      max = parseInt(anchor.id);
    }
  }
  return max;
}
