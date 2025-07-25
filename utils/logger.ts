import { createLogger, transports, format, Logger } from "winston";
import path from "path";
import fs from "fs";

// Ensure the logs directory exists
const logDir = path.resolve(__dirname, "../logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Winston logger instance
 * Logs to both console and file
 */
export const logger: Logger = createLogger({
  level: "info", // Default log level
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Timestamp format
    format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
  ),
  transports: [
    new transports.Console(), // Log to console
    new transports.File({ filename: path.join(logDir, "app.log") }) // Log to file
  ],
});
