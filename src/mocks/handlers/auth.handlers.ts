import { http, HttpResponse } from 'msw';
import { environment } from '../../environments/environment';
import type { AuthUser, LoginDto, LoginResponse } from '../../api/auth.api';
import { getUserByUsername } from './users.handlers';

const base = environment.apiBaseUrl;

const sessions = new Map<string, AuthUser>();

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const authHandlers = [
  http.post(`${base}/auth/login`, async ({ request }) => {
    const body = (await request.json().catch(() => null)) as LoginDto | null;
    const username = body?.username?.trim() ?? '';
    const password = body?.password ?? '';
    if (!username || !password) {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    const record = getUserByUsername(username);
    if (!record || record.password !== password) {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    const user: AuthUser = {
      id: record.id,
      username: record.username,
      role: record.role,
    };
    const token = `mock.${uuid()}`;
    sessions.set(token, user);
    return HttpResponse.json<LoginResponse>({ access_token: token, user });
  }),

  http.post(`${base}/auth/logout`, ({ request }) => {
    const header = request.headers.get('authorization') ?? '';
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : null;
    if (token) {
      sessions.delete(token);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${base}/auth/me`, ({ request }) => {
    const header = request.headers.get('authorization') ?? '';
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7) : null;
    if (!token) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const user = sessions.get(token);
    if (!user) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return HttpResponse.json<AuthUser>(user);
  }),
];
