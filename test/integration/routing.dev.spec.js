describe('Routing Dev', () => {
  she('// Things Aden already does but are untested...');
  she('creates routes if specified in page.route');
  she('does not route pages with { route: false; } > .server');
  she('uses routes relative to page path route { route: \'/some.ext\';} > /page/some.ext');
  she('puts greedy routes at the end of the stack');
  she('allows params in page path /user/:id/edit');
  she('allows params in { route: \'/:id\'} > .server');
});
