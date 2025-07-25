import rateLimit from "express-rate-limit";

// Limit to 10 requests/minute
export const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many requests. Please try again later.",
});
