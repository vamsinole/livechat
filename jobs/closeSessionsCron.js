
const cron = require('node-cron');
const { doRequest } = require('../utils/doRequest.js')
const timeStamp = require('../utils/timeStamp.js')
const PORT = process.env.PORT;

const closeSessionCron = cron.schedule("*/1 * * * *", async function () {

  let timesta = timeStamp();
  console.log(
    "running a task every  10 minutes ran at"
    + timesta);
  let options = {
    method: "GET",
    url: `https://smatbot.com:${PORT}/closeSessions`,
    headers: {
      Connection: "keep-alive",
      "Content-Type": "application/json",
    },
  };
  try {
    console.log(options);
    let resp = await doRequest(options);
    console.log(resp)

  } catch (err) {
    console.log(err);
  }

});


module.exports = closeSessionCron