const MSCP = require("mscp");
const Handler = require("./handler.js");
const path = require("path");

(async () => {
  let mscp = new MSCP(Handler)
  mscp.server.static(path.join(__dirname, 'www'));
  mscp.start();
})()
