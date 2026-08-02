import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool";
import { UserRole } from "../types";

// only for local dev, real deployments should set JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET ?? "sdcip-pilot-dev-secret-do-not-use-in-prod";
const TOKEN_TTL = "8h";

export interface AuthTokenPayload {
  sub: string; // user id
  role: UserRole;
  name: string;
  email: string;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password.");
  }
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthTokenPayload }> {
  const { rows } = await pool.query(
    `SELECT id, name, role, email, password_hash FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new InvalidCredentialsError();
  }
  const payload: AuthTokenPayload = { sub: user.id, role: user.role, name: user.name, email: user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
  return { token, user: payload };
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
