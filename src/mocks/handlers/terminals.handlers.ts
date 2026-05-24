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

interface TerminalRecord {
  id: string;
  campaignId: string;
  // Stored content never carries meta.id (server-owned, injected on read).
  // meta.hiddenId is the user-authored, per-campaign-unique slug.
  content: TerminalContent;
  views?: number;
  createdAt: string;
  updatedAt: string;
}

export const terminalsStore = new Map<string, TerminalRecord>();

// Seed two fixture terminals for the first fixture campaign
const seed: Omit<TerminalRecord, 'updatedAt'>[] = [
  {
    id: 'terminal-omega',
    campaignId: 'campaign-alpha',
    views: 42,
    createdAt: '2026-01-12T09:30:00.000Z',
    content: {
      meta: { title: 'Terminale Omega', public: false, hiddenId: 'omega-admin' },
      state: {
        local: {},
        global: {
          session_active: { type: 'boolean', default: false },
        },
      },
      login: { users: [] },
      nodes: { start: { text: 'Benvenuto nel Terminale Omega.', choices: [] } },
    },
  },
  {
    id: 'terminal-gamma',
    campaignId: 'campaign-alpha',
    // views intentionally omitted to exercise the undefined case
    createdAt: '2026-02-03T14:05:00.000Z',
    content: {
      meta: { title: 'Terminale Gamma', public: true, hiddenId: 'gamma-access' },
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

/** Strip the server-owned meta.id before storing client-supplied content. */
function stripMetaId(content: TerminalContent): TerminalContent {
  const meta = { ...content.meta };
  delete meta.id;
  return { ...content, meta };
}

/** Inject the server-owned meta.id for reads (GET / PUT response). */
function withMetaId(content: TerminalContent, id: string): TerminalContent {
  return { ...content, meta: { ...content.meta, id } };
}

/** hiddenId must be unique within a campaign (only checked when present). */
function hiddenIdTaken(campaignId: string, hiddenId: string, exceptId?: string): boolean {
  for (const r of terminalsStore.values()) {
    if (r.campaignId === campaignId && r.id !== exceptId && r.content.meta.hiddenId === hiddenId) {
      return true;
    }
  }
  return false;
}

function toDto(record: TerminalRecord): TerminalDto {
  return {
    id: record.id,
    hiddenId: record.content.meta.hiddenId,
    meta: { ...record.content.meta, id: record.id },
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
    const body = (await request.json().catch(() => null)) as TerminalContent | null;
    if (!body) {
      return HttpResponse.json({ message: 'Invalid body' }, { status: 400 });
    }
    const content = stripMetaId(body);
    const hiddenId = content.meta.hiddenId;
    if (hiddenId && hiddenIdTaken(campaignId, hiddenId)) {
      return HttpResponse.json(
        { message: `hiddenId "${hiddenId}" già in uso in questa campagna` },
        { status: 409 },
      );
    }
    const id = uuid();
    const now = new Date().toISOString();
    const record: TerminalRecord = {
      id,
      campaignId,
      content,
      views: 0,
      createdAt: now,
      updatedAt: now,
    };
    terminalsStore.set(id, record);
    return HttpResponse.json(toDto(record), { status: 201 });
  }),

  // Resolve a terminal by user-authored hiddenId (the only hiddenId-keyed endpoint)
  http.get(`${base}/campaigns/:campaignId/terminals/by-hidden-id/:hiddenId`, ({ params }) => {
    const campaignId = params['campaignId'] as string;
    const hiddenId = params['hiddenId'] as string;
    const record = Array.from(terminalsStore.values()).find(
      (t) => t.campaignId === campaignId && t.content.meta.hiddenId === hiddenId,
    );
    if (!record) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json(toDto(record));
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
    const body = (await request.json().catch(() => null)) as TerminalContent | null;
    if (!body) {
      return HttpResponse.json({ message: 'Invalid body' }, { status: 400 });
    }
    const content = stripMetaId(body);
    const hiddenId = content.meta.hiddenId;
    if (hiddenId && hiddenIdTaken(campaignId, hiddenId)) {
      return HttpResponse.json(
        { message: `hiddenId "${hiddenId}" già in uso in questa campagna` },
        { status: 409 },
      );
    }
    const id = uuid();
    const now = new Date().toISOString();
    const record: TerminalRecord = {
      id,
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
    return HttpResponse.json(withMetaId(record.content, record.id));
  }),

  http.put(`${base}/terminals/:id`, async ({ params, request }) => {
    const id = params['id'] as string;
    const record = terminalsStore.get(id);
    if (!record) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const body = (await request.json().catch(() => null)) as TerminalContent | null;
    if (!body) {
      return HttpResponse.json({ message: 'Invalid body' }, { status: 400 });
    }
    const content = stripMetaId(body);
    const hiddenId = content.meta.hiddenId;
    if (hiddenId && hiddenIdTaken(record.campaignId, hiddenId, id)) {
      return HttpResponse.json(
        { message: `hiddenId "${hiddenId}" già in uso in questa campagna` },
        { status: 409 },
      );
    }
    record.content = content;
    record.updatedAt = new Date().toISOString();
    return HttpResponse.json(withMetaId(record.content, record.id));
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
    // Export strips meta.id (already absent from stored content) so the file re-imports cleanly.
    return HttpResponse.json(record.content);
  }),
];
