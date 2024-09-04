import typing
from typing import Any, Callable

import ipywidgets as widgets
from ipywidgets import CallbackDispatcher, register
from traitlets import Bool, Dict, Float, Int, List, Unicode


@register
class AnchorViz(widgets.DOMWidget):
    """The python widget for the AnchorViz visualization, see
    _Chen, Nan-Chen, et al. "AnchorViz: Facilitating classifier error discovery
    through interactive semantic data exploration."_
    """

    # Name of the widget view class in front-end
    _view_name = Unicode("AnchorVizView").tag(sync=True)
    _model_name = Unicode("AnchorVizModel").tag(sync=True)

    _view_module = Unicode("ipyanchorviz").tag(sync=True)
    _model_module = Unicode("ipyanchorviz").tag(sync=True)

    _view_module_version = Unicode("^0.3.0").tag(sync=True)
    """Version of the front-end module containing widget view."""
    _model_module_version = Unicode("^0.3.0").tag(sync=True)
    """Version of the front-end module containing widget model."""

    # Widget specific property.
    # Widget properties are defined as traitlets. Any property tagged with `sync=True`
    # is automatically synced to the frontend *any* time it changes in Python.
    # It is synced back to Python from the frontend *any* time the model is touched.
    selectedAnchorID = Unicode("").tag(sync=True)
    """The ID key of the currently selected anchor."""
    anchors = List(None, []).tag(sync=True)
    """The list of anchor dictionaries."""
    selectedDataPointID = Unicode("").tag(sync=True)
    """The ID key of the last hovered datapoint."""
    data = List(None, []).tag(sync=True)
    """The list of point data dictionaries."""
    autoNorm = Bool(False).tag(sync=True)
    """Whether to normalize the datapoint anchor weights. (The sum cannot exceed 1.)
        Set this to :code:`False` if you are normalizing the weights yourself."""
    lassoedPointIDs = List(None, []).tag(sync=True)
    """The list of ID keys of the points within the last lassoed area."""

    margin = Dict(dict(left=80, right=80, top=80, bottom=30)).tag(sync=True)
    """Margins on each side of the ring to the edges of the widget."""
    radius = Int(275).tag(sync=True)
    """The size of the ring."""
    ringInnerPadding = Int(35).tag(sync=True)
    """The minimum amount of padding between the ring border and any contained points."""
    anchorTextOffset = Int(20).tag(sync=True)
    """How far to place the anchor labels from the edge of the ring."""
    pointSize = Float(2.0).tag(sync=True)
    """Radius of the datapoints inside the ring."""
    anchorSize = Float(6.0).tag(sync=True)
    """Radius of the anchor points along the ring."""
    focusIndicatorSize = Float(8.5).tag(sync=True)
    """How large to draw the cursor circle."""
    focusIndicatorActionDistance = Int(20).tag(sync=True)
    """Mouse cursor distance from the ring to allow ring click action."""
    animationTime = Int(2000).tag(sync=True)
    """Duration of animation effects on update."""
    noiseMagnitude = Int(15).tag(sync=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._anchor_add_callbacks = CallbackDispatcher()
        self._anchor_drag_callbacks = CallbackDispatcher()
        self._lasso_change_callbacks = CallbackDispatcher()

        self.on_msg(self._custom_handle_msg)

    def _custom_handle_msg(self, widget, content, callback):
        """Message handler that redirects messages from the JS widget to the
        user-specified python callback functions.
        """
        if content["type"] == "anchor_add":
            self._anchor_add_callbacks(content)
        elif content["type"] == "anchor_drag":
            self._anchor_drag_callbacks(content)
        elif content["type"] == "lasso_change":
            self._lasso_change_callbacks(content)

    def _find_unique_list_id(self, entities: list[dict]) -> int:
        if len(entities) == 0:
            return 0
        max_id = int(entities[0]["id"])
        for index, entity in enumerate(entities[1:]):
            if int(entity["id"]) > max_id:
                max_id = int(entity["id"])
        return max_id + 1

    def on_anchor_add(self, callback: Callable, remove: bool = False):
        """Register a callback function for when an anchor is added from within the
        JS component. This occurs when the user clicks on the ring circumference.

        Args:
            callback (Callable): The function to call when an anchor is added.
            remove (bool): Set this to true to remove instead of add.
        """
        self._anchor_add_callbacks.register_callback(callback, remove=remove)

    def on_anchor_drag(self, callback: Callable, remove: bool = False):
        """Register a callback function for when a user has finished dragging an anchor.

        Args:
            callback (Callable): The function to call when an anchor is through being dragged.
            remove (bool): Set this to true to remove instead of add.
        """
        self._anchor_drag_callbacks.register_callback(callback, remove=remove)

    def on_lasso_change(self, callback: Callable, remove: bool = False):
        """Register a callback function for when a user has lassoed a different set of points.

        Args:
            callback (Callable): The function to call when points have been lassoed.
            remove (bool): Set this to true to remove instead of add.
        """
        self._lasso_change_callbacks.register_callback(callback, remove=remove)

    # ==============================================
    # ANCHOR MUTATIONS
    # ==============================================

    def add_anchor(self, anchor_data: dict[str, Any]):
        """Add the passed dictionary to the list of anchors. If an 'id' key is
        not provided, the first available numeric ID not already in use will be
        applied and returned.

        Returns:
            The 'id' key of the anchor data.
        """
        if "id" not in anchor_data:
            anchor_data["id"] = self._find_unique_list_id(self.anchors)
        self.anchors.append(anchor_data)
        self.notify_change({"name": "anchors", "type": "change"})
        return anchor_data["id"]

    def modify_anchor(self, array_index: int, key: str, new_value: Any):
        """Change a single key-value pair in the anchor at the given index.

        Args:
            array_index (int): The index of the anchor in the :code:`anchors` list.
            key (str): The key whose value to replace in the anchor data dictionary.
            new_value (Any): The new value to replace with.
        """
        self.anchors[array_index][key] = new_value
        self.notify_change({"name": "anchors", "type": "change"})

    def modify_anchor_by_id(self, id: int, key: str, new_value: Any):
        """Change a single key-value pair in the anchor with the given ID key.

        Args:
            id (int): The 'id' field of the anchor in the :code:`anchors` list.
            key (str): The key whose value to replace in the anchor data dictionary.
            new_value (Any): The new value to replace with.
        """
        for index, anchor in enumerate(self.anchors):
            if anchor["id"] == id:
                self.modify_anchor(index, key, new_value)
                break

    def remove_anchor(self, array_index: int):
        """Remove the anchor at the given index in the anchors array.

        Args:
            array_index (int): The index of the anchor in the ``anchors`` list.
        """
        del self.anchors[array_index]
        self.notify_change({"name": "anchors", "type": "change"})

    def remove_anchor_by_id(self, id: int):
        """Remove the anchor with the given ID key.

        Args:
            id (int): the 'id' field of the anchor in the ``anchors`` list.
        """
        for index, anchor in enumerate(self.anchors):
            if anchor["id"] == id:
                self.remove_anchor(index)
                break

    def set_anchors(self, anchors_data: typing.List[dict[str, Any]]):
        """Replace the full list of anchors with the given list."""
        self.anchors = anchors_data
        self.notify_change({"name": "anchors", "type": "change"})

    def set_anchor(self, array_index: int, new_anchor: dict[str, Any]):
        """Replace the anchor data dictionary at the given index.

        Args:
            array_index (int): The index of the anchor in the :code:`anchors` list.
            new_anchor (dict[str, Any]): The dictionary with the new anchor's data.
        """
        self.anchors[array_index] = new_anchor
        self.notify_change({"name": "anchors", "type": "change"})

    def set_anchor_by_id(self, id: int, new_anchor: dict[str, Any]):
        """Replace the anchor data dictionary with the given ID key.

        Args:
            id (int): The 'id' field of the anchor in the :code:`anchors` list.
            new_anchor (dict[str, Any]): The dictionary with the new anchor's data.
        """
        for index, anchor in enumerate(self.anchors):
            if anchor["id"] == id:
                self.set_anchor(index, new_anchor)
                break

    # ==============================================
    # POINT MUTATIONS
    # ==============================================

    def add_point(self, point: dict[str, Any]):
        """Add the passed dictionary to the list of datapoints. If an 'id' key is
        not provided, the first available numeric ID not already in use will be
        applied and returned.

        Returns:
            The 'id' key of the datapoint.
        """
        if "id" not in point:
            point["id"] = self._find_unique_list_id(self.data)
        self.data.append(point)
        self.notify_change({"name": "data", "type": "change"})
        return point["id"]

    def modify_point(self, array_index: int, key: str, new_value: Any):
        """Change a single key-value pair in the datapoint at the given index.

        Args:
            array_index (int): The index of the datapoint in the :code:`data` list.
            key (str): The key whose value to replace in the datapoint's dictionary.
            new_value (Any): The new value to replace with.
        """
        self.data[array_index][key] = new_value
        self.notify_change({"name": "data", "type": "change"})

    def modify_point_by_id(self, id: int, key: str, new_value: Any):
        """Change a single key-value pair in the datapoint with the given ID key.

        Args:
            id (int): The 'id' field of the datapoint in the :code:`data` list.
            key (str): The key whose value to replace in the datapoint's dictionary.
            new_value (Any): The new value to replace with.
        """
        for index, point in enumerate(self.data):
            if point["id"] == id:
                self.modify_point(index, key, new_value)
                break

    def set_points(self, points: typing.List[dict[str, Any]]):
        """Replace the full list of datapoints with the given list."""
        self.data = points
        self.notify_change({"name": "data", "type": "change"})

    def set_point(self, array_index: int, new_point: dict[str, Any]):
        """Replace the datapoint dictionary at the given index.

        Args:
            array_index (int): The index of the datapoint in the :code:`data` list.
            new_anchor (dict[str, Any]): The dictionary with the new datapoint.
        """
        self.data[array_index] = new_point
        self.notify_change({"name": "data", "type": "change"})

    def set_point_by_id(self, id: int, new_point: dict[str, Any]):
        """Replace the datapoint's dictionary with the given ID key.

        Args:
            id (int): The 'id' field of the datapoint in the :code:`data` list.
            new_anchor (dict[str, Any]): The dictionary with the new datapoint's data.
        """
        for index, point in enumerate(self.data):
            if point["id"] == id:
                self.set_point(index, new_point)
                break
