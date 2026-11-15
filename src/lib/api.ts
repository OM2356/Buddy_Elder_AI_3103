export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'API_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TOKEN_STORAGE_KEY = 'buddy_elder_session_token';

function readStoredToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function writeStoredToken(token: string | null) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }
}

let authToken: string | null = readStoredToken();

export function setApiToken(token: string | null) {
  authToken = token;
  writeStoredToken(token);
}

export function getApiToken(): string | null {
  return authToken;
}

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const rawBase =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
      ? String(import.meta.env.VITE_API_BASE_URL).trim().replace(/\/+$/, '')
      : '';
  if (!rawBase) return path;
  return `${rawBase}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getApiToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    setApiToken(null);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(
        response.status === 404
          ? 'API endpoint returned 404 Not Found. Check your backend deployment or VITE_API_BASE_URL.'
          : `Request failed with status ${response.status}`,
        response.status,
        response.status === 404 ? 'NOT_FOUND' : 'API_ERROR'
      );
    }
    throw new ApiError(
      'Received unexpected non-JSON response from API endpoint. Verify backend routing on /api/*.',
      502,
      'INVALID_API_RESPONSE'
    );
  }

  const data = await response.json();
  if (!response.ok || data?.ok === false) {
    throw new ApiError(
      data?.error || `Request failed (${response.status})`,
      response.status,
      data?.code || 'API_ERROR'
    );
  }
  return data as T;
}
