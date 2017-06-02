module.exports = (attitude) => {
  
  attitude.supportedMethods.forEach((method) => {
    attitude.registerFile(`${method}Path`, new RegExp(`\.${method}\.jsx?$`), {
      build: false,
      watch: true,
    });
  });
    
  attitude.hook('load', ({ page }) => {
    const controllerLoaders = page.methods.value.map((method) => {
      const methodKey = page[`${method.toLowerCase()}Path`];
      if (methodKey.resolved) {
        return attitude.loadWrappedFn(methodKey, page)
          .then((controller) => Object.assign(page, {
            [method]: controller,
          }));
      }
    });
  });
};
