var plugin = require('./index');
var base = require('@jupyter-widgets/base');

module.exports = {
  id: 'ipyanchorviz:plugin',
  requires: [base.IJupyterWidgetRegistry],
  activate: function(app, widgets) {
      widgets.registerWidget({
          name: 'ipyanchorviz',
          version: plugin.version,
          exports: plugin
      });
  },
  autoStart: true
};
