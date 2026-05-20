import { http, HttpResponse } from 'msw';
import { environment } from '../../environments/environment';
import type { TerminalContent } from '../../app/domain/terminal-schema';
import type { TerminalDto } from '../../app/core/terminal/terminal.types';

const base = environment.apiBaseUrl;

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function codename(): string {
  return `TRM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

interface TerminalRecord {
  id: string;
  hiddenId: string;
  campaignId: string;
  content: TerminalContent;
  views?: number;
  createdAt: string;
  updatedAt: string;
}

const terminalsStore = new Map<string, TerminalRecord>();

// Seed two fixture terminals for the first fixture campaign
const seed: Omit<TerminalRecord, 'updatedAt'>[] = [
  {
    id: 'terminal-omega',
    hiddenId: 'TRM-OMEGA',
    campaignId: 'campaign-alpha',
    views: 42,
    createdAt: '2026-01-12T09:30:00.000Z',
    content: {
      meta: { id: 'omega-terminale', title: 'Terminale Omega', public: false },
      state: { local: {}, global: {} },
      login: { users: [] },
      nodes: { start: { text: 'Benvenuto nel Terminale Omega.', choices: [] } },
    },
  },
  {
    id: 'terminal-gamma',
    hiddenId: 'TRM-GAMMA',
    campaignId: 'campaign-alpha',
    // views intentionally omitted to exercise the undefined case
    createdAt: '2026-02-03T14:05:00.000Z',
    content: {
      meta: { id: 'gamma-terminale', title: 'Terminale Gamma', public: true },
      state: {
        local: {
          access_count: { type: 'number', default: 0 },
        },
        global: {},
      },
      login: { users: [] },
      nodes: { start: { text: 'Accesso a Terminale Gamma in corso.', choices: [] } },
    },
  },
];

for (const s of seed) {
  terminalsStore.set(s.id, { ...s, updatedAt: s.createdAt });
}

function toDto(record: TerminalRecord): TerminalDto {
  return {
    id: record.id,
    hiddenId: record.hiddenId,
    meta: record.content.meta,
    campaignId: record.campaignId,
    views: record.views,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export const terminalsHandlers = [
  // Import before create to match more specific path first
  http.post(`${base}/campaigns/:campaignId/terminals/import`, async ({ params, request }) => {
    const campaignId = params['campaignId'] as string;
    const content = (await request.json().catch(() => null)) as TerminalContent | null;
    if (!content) {
      return HttpResponse.json({ message: 'Invalid body' }, { status: 400 });
    }
    const id = uuid();
    const now = new Date().toISOString();
    const record: TerminalRecord = {
      id,
      hiddenId: codename(),
      campaignId,
      content: { ...content, meta: { ...content.meta, id } },
      views: 0,
      createdAt: now,
      updatedAt: now,
    };
    terminalsStore.set(id, record);
    return HttpResponse.json(toDto(record), { status: 201 });
  }),

  http.get(`${base}/campaigns/:campaignId/terminals`, ({ params }) => {
    const campaignId = params['campaignId'] as string;
    const results = Array.from(terminalsStore.values())
      .filter((t) => t.campaignId === campaignId)
      .map(toDto);
    return HttpResponse.json(results);
  }),

  http.post(`${base}/campaigns/:campaignId/terminals`, async ({ params, request }) => {
    const campaignId = params['campaignId'] as string;
    const content = (await request.json().catch(() => null)) as TerminalContent | null;
    if (!content) {
      return HttpResponse.json({ message: 'Invalid body' }, { status: 400 });
    }
    const id = uuid();
    const now = new Date().toISOString();
    const record: TerminalRecord = {
      id,
      hiddenId: codename(),
      campaignId,
      content,
      views: 0,
      createdAt: now,
      updatedAt: now,
    };
    terminalsStore.set(id, record);
    return HttpResponse.json(toDto(record), { status: 201 });
  }),

  http.get(`${base}/terminals/:id`, ({ params }) => {
    const id = params['id'] as string;
    const record = terminalsStore.get(id);
    if (!record) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json(record.content);
  }),

  http.delete(`${base}/terminals/:id`, ({ params }) => {
    const id = params['id'] as string;
    if (!terminalsStore.has(id)) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    terminalsStore.delete(id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${base}/terminals/:id/export`, ({ params }) => {
    const id = params['id'] as string;
    const record = terminalsStore.get(id);
    if (!record) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json(record.content);
  }),
];
