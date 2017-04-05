module.exports = () => {
  return (args) => {
    args.html = '<html>TEST HTML ' + args.req.path + '</html>';
    return args;
  };
};
