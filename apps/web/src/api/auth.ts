import type { LoginInput, PublicUser, RegisterInput } from '@scrabble/shared';
import { ApiError, api } from './http.js';

export async function registerAccount(input: RegisterInput): Promise<PublicUser> {
  const res = await api.post<{ user: PublicUser }>('/auth/register', input);
  return res.user;
}

export async function login(input: LoginInput): Promise<PublicUser> {
  const res = await api.post<{ user: PublicUser }>('/auth/login', input);
  return res.user;
}

export async function logout(): Promise<void> {
  await api.post<void>('/auth/logout');
}

export async function fetchCurrentUser(): Promise<PublicUser | null> {
  try {
    const res = await api.get<{ user: PublicUser }>('/auth/me');
    return res.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
