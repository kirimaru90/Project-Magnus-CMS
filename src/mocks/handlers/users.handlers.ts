import { http, HttpResponse } from 'msw';
import { environment } from '../../environments/environment';
import type { UserRole } from '../../app/core/user/user.types';
import { removeUserFromAllCampaigns } from './campaigns.handlers';

const base = environment.apiBaseUrl;

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface UserRecord {
  id: string;
  username: string;
  role: UserRole;
  password: string;
}

const users: UserRecord[] = [
  { id: 'user-admin', username: 'admin', role: 'admin', password: 'admin' },
  { id: 'user-p1', username: 'p1', role: 'player', password: 'p1' },
  { id: 'user-p2', username: 'p2', role: 'player', password: 'p2' },
  { id: 'user-p3', username: 'p3', role: 'player', password: 'p3' },
];

export function getUserById(id: string): UserRecord | undefined {
  return users.find((u) => u.id === id);
}

export function getAllPlayers(): UserRecord[] {
  return users.filter((u) => u.role === 'player');
}

export function getUserByUsername(username: string): UserRecord | undefined {
  return users.find((u) => u.username === username);
}

function toDto(u: UserRecord) {
  return { id: u.id, username: u.username, role: u.role };
}

export const usersHandlers = [
  http.get(`${base}/users`, () => {
    return HttpResponse.json(users.map(toDto));
  }),

  http.post(`${base}/users`, async ({ request }) => {
    const body = (await request.json().catch(() => null)) as Partial<UserRecord> | null;
    if (!body?.username || !body?.role || !body?.password) {
      return HttpResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }
    const user: UserRecord = {
      id: uuid(),
      username: body.username,
      role: body.role as UserRole,
      password: body.password,
    };
    users.push(user);
    return HttpResponse.json(toDto(user), { status: 201 });
  }),

  http.get(`${base}/users/:id`, ({ params }) => {
    const user = users.find((u) => u.id === params['id']);
    if (!user) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json(toDto(user));
  }),

  http.put(`${base}/users/:id`, async ({ params, request }) => {
    const idx = users.findIndex((u) => u.id === params['id']);
    if (idx === -1) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const body = (await request.json().catch(() => null)) as Partial<UserRecord> | null;
    if (body?.username !== undefined) users[idx].username = body.username;
    if (body?.role !== undefined) users[idx].role = body.role as UserRole;
    if (body?.password !== undefined) users[idx].password = body.password;
    return HttpResponse.json(toDto(users[idx]));
  }),

  http.delete(`${base}/users/:id`, ({ params }) => {
    const idx = users.findIndex((u) => u.id === params['id']);
    if (idx === -1) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const [removed] = users.splice(idx, 1);
    removeUserFromAllCampaigns(removed.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
