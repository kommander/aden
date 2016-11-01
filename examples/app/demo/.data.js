module.exports = () => (args) => {
  args.data.name = args.req.query.name; // eslint-disable-line
  return args;
};
