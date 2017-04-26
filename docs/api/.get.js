module.exports = (server) => {
  console.log(server.id);
  return (request, response, page) => {
    console.log('request recieved');
    const result = [{
      message: 'great example text'
    }]
    response.json(result[0]);
  }
}
