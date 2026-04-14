import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

export async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function signToken(userId) {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

export function signShortLivedToken(userId, expiresIn = "5m") {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn });
}

export function getUserIdFromAuthHeader(authHeader) {
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    return payload.userId;
  } catch {
    return null;
  }
}
