const { createLogger, format, transports } = require("winston");
const { combine, timestamp, json, printf } = format;
require("winston-daily-rotate-file");

//Winston Logger initialisation

let myFormat = printf(({ level, message, timestamp }) => {
    return `[${level},${timestamp},${message}]`
})

let transport = new transports.DailyRotateFile({
    filename: "./logs/%DATE%.log",
    prepend: true,
    level: process.env.ENV === "development" ? "debug" : "info",
});

let logger = createLogger({
    format: combine(
        timestamp(),
        myFormat
    ),
    //transports: [new transports.Console()]
    transports: [transport],
});


module.exports = logger;
