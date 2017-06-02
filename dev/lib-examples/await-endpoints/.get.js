const { async, await } = require('asyncawait');

const callback = async () => Promise.resolve(42);
const controller = async (req, res) => await Promise.resolve()
  .then(() => new Promise((resolve, reject) => 
    setTimeout(() => resolve(callback()), 1000)
  ))
  .then((val) => res.send(`Value: ${val}`));

module.exports = () => controller;