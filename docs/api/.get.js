module.exports = () => {
  return (request, response) => {
    const result = [{
      message: 'great example text',
    }];
    response.json(result[0]);
  };
};
