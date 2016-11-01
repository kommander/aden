// Aden Client Core

// INFO: Do _not_ provide redux store, as it is app specific,
//       The Aden client provides facilities up until routing pages to modules.
//       Even the router is provided as plugin itself and can be exchanged
//       However, with the provided hooks in app/client, Adens core client
//       can be extended to provide shareable modules on app level like redux/api/i18n

function init() {
  console.log('Aden Client Core'); // eslint-disable-line
  // TODO: Setup router with page info from aden backend
  // TODO: Inject aden into loaded page main modules
  // TODO: Provide facilities to hook into aden client Setup
  //       >> to provide something like a redux store as shared module
}
init();
