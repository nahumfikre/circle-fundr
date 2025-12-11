import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

interface JwtPayload {
  userId: string;
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // First, try to get token from HTTP-only cookie (preferred method)
  let token = req.cookies?.access_token;

  // Fallback: check Authorization header for backward compatibility
  if (!token) {
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) {
      token = header.substring("Bearer ".length).trim();
    }
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "Missing or invalid authentication credentials" });
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;

    (req as any).userId = decoded.userId;

    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
