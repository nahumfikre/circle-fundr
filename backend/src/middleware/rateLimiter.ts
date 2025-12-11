import rateLimit from "express-rate-limit";

// Strict rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many authentication attempts, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Rate limiting for verification code attempts
export const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 attempts per hour
  message: "Too many verification attempts, please try again after an hour.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for resend verification
export const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 resends per hour
  message: "Too many resend requests, please try again after an hour.",
  standardHeaders: true,
  legacyHeaders: false,
});
