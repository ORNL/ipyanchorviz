import {AnchorVizModel, AnchorVizView, version} from './index';
import {IJupyterWidgetRegistry} from '@jupyter-widgets/base';

export const helloWidgetPlugin = {
  id: 'ipyanchorviz:plugin',
  requires: [IJupyterWidgetRegistry],
  activate: function(app, widgets) {
      widgets.registerWidget({
          name: 'ipyanchorviz',
          version: version,
          exports: { AnchorVizModel, AnchorVizView }
      });
  },
  autoStart: true
};

export default helloWidgetPlugin;
