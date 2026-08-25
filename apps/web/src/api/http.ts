const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error?: { code: string; message: string };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Ne poser Content-Type: application/json que s'il y a réellement un corps JSON à envoyer
  // — sinon Fastify rejette la requête (POST/DELETE sans body) avec
  // FST_ERR_CTP_EMPTY_JSON_BODY ("Body cannot be empty when content-type is set to
  // 'application/json'"), qui remonte en 500 générique côté client. Affectait en silence
  // toute requête sans body (ex: la déconnexion).
  const hasBody = init?.body !== undefined;
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers ?? {}) },
    ...init,
  });

  const isEmpty = response.status === 204;
  const body = isEmpty ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = body as ErrorBody | null;
    const error = errorBody?.error ?? { code: 'UNKNOWN_ERROR', message: 'Une erreur est survenue.' };
    throw new ApiError(response.status, error.code, error.message);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, data?: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
};
