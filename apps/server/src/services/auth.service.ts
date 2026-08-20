import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { LoginInput, PublicUser, RegisterInput } from '@scrabble/shared';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../errors.js';

const BCRYPT_ROUNDS = 12;
export const SESSION_COOKIE_NAME = 'scrabble_session';
export const GUEST_COOKIE_NAME = 'scrabble_guest';

export interface SessionPayload {
  sub: string; // userId
  isAdmin: boolean;
}

export class AuthError extends HttpError {
  constructor(statusCode: number, code: string, message: string) {
    super(statusCode, code, message);
    this.name = 'AuthError';
  }
}

function toPublicUser(user: { id: string; email: string; pseudo: string; isAdmin: boolean }): PublicUser {
  return { id: user.id, email: user.email, pseudo: user.pseudo, isAdmin: user.isAdmin };
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '30d' });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export function generateGuestId(): string {
  return randomUUID();
}

export async function register(input: RegisterInput): Promise<{ user: PublicUser; token: string }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AuthError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet email.');
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, pseudo: input.pseudo },
  });
  const token = signSession({ sub: user.id, isAdmin: user.isAdmin });
  return { user: toPublicUser(user), token };
}

export async function login(input: LoginInput): Promise<{ user: PublicUser; token: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AuthError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect.');
  }
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AuthError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect.');
  }
  const token = signSession({ sub: user.id, isAdmin: user.isAdmin });
  return { user: toPublicUser(user), token };
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? toPublicUser(user) : null;
}
