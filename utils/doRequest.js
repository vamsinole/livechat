const request = require("request");


function doRequest(options) {
    return new Promise((resolve, reject) => {
        request(options, (err, response, body) => {
            if (err) resolve(err);

            resolve(body);
        });
    });
}




module.exports = { doRequest };
