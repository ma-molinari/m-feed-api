import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports:
    process.env.NODE_ENV === "dev"
      ? [
          new winston.transports.File({
            filename: "localhost.log",
            maxsize: 10000000,
          }),
        ]
      : [],
});

export default logger;
