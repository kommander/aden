/* eslint-disable */
var hotClient = require('webpack-hot-middleware/client?reload=true&name=frontend');
hotClient.subscribe(function subscriber(event) {
  if (event.action === 'reload') {
    window.location.reload();
  }
});
