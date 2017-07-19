var hotClient = require('webpack-hot-middleware/client?reload=true&name=frontend');
console.log('dev client');
hotClient.subscribe(function (event) {
  if (event.action === 'reload') {
    window.location.reload();
  }
});