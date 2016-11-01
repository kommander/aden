const fs = require('fs');
const path = require('path');

// TODO: Separate out devapp as a separate process app,
//       consuming information from apps running in dev mode
module.exports = function setupRender(aden) {
  // For now we only support running one app in dev
  const runningAppPos = aden.allAppsPosition === 0 ? 1 : 0;
  const runApp = aden.allApps[runningAppPos];

  const listContent = fs.readFileSync(path.resolve(
    __dirname, 'list.mustache'
  ), 'utf8');

  return (args) => Promise.resolve().then(() => {
    args.html = args.page.templateFn({ // eslint-disable-line
      name: runApp.name,
      rootBasePath: runApp.rootPage.basePath,
      children: runApp.rootPage.children,
    }, { list: listContent });
    return args;
  });
};
