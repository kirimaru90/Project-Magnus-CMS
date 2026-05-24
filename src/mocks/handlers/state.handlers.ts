import { http, HttpResponse } from 'msw';
import { environment } from '../../environments/environment';
import { terminalsStore } from './terminals.handlers';
import type { StateEntryDto, GlobalVarDecl } from '../../app/core/state/state.types';

const base = environment.apiBaseUrl;

// keyed "terminal:<id>" or "campaign:<id>" -> Map<varName, currentValue>
const currentValues = new Map<string, Map<string, unknown>>();

// Campaign-level global variable schema store: campaignId -> Map<varName, GlobalVarDecl>
const campaignGlobalSchemas = new Map<string, Map<string, GlobalVarDecl>>();

function getGlobalSchema(campaignId: string): Map<string, GlobalVarDecl> {
  if (!campaignGlobalSchemas.has(campaignId)) {
    campaignGlobalSchemas.set(campaignId, new Map());
  }
  return campaignGlobalSchemas.get(campaignId)!;
}

// Seed campaign global schemas from existing terminal state.global declarations
for (const record of terminalsStore.values()) {
  const schema = getGlobalSchema(record.campaignId);
  for (const [varName, decl] of Object.entries(record.content.state.global)) {
    if (!schema.has(varName)) {
      schema.set(varName, decl as GlobalVarDecl);
    }
  }
}

function getOverrideMap(storeKey: string): Map<string, unknown> {
  if (!currentValues.has(storeKey)) {
    currentValues.set(storeKey, new Map());
  }
  return currentValues.get(storeKey)!;
}

function typeCheckValue(type: string, value: unknown): boolean {
  switch (type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && !isNaN(value as number);
    case 'string':
      return typeof value === 'string';
    case 'enum':
      return typeof value === 'string';
    default:
      return false;
  }
}

function applyAtom(
  overrideMap: Map<string, unknown>,
  varName: string,
  op: string,
  value: unknown,
  by: unknown,
  currentVal: unknown,
): void {
  if (op === 'set') {
    overrideMap.set(varName, value);
  } else if (op === 'increment') {
    overrideMap.set(varName, (currentVal as number) + (by as number));
  } else if (op === 'toggle') {
    overrideMap.set(varName, !currentVal);
  }
}

export const stateHandlers = [
  // GET /terminals/:id/state
  http.get(`${base}/terminals/:id/state`, ({ params }) => {
    const id = params['id'] as string;
    const record = terminalsStore.get(id);
    if (!record) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const overrides = getOverrideMap(`terminal:${id}`);
    const local = record.content.state.local;
    const entries: StateEntryDto[] = Object.entries(local)
      .map(([key, decl]) => {
        const current = overrides.has(key) ? overrides.get(key)! : decl.default;
        const entry: StateEntryDto = {
          key,
          type: decl.type as StateEntryDto['type'],
          default: decl.default as StateEntryDto['default'],
          current: current as StateEntryDto['current'],
        };
        if (decl.type === 'enum') {
          entry.values = (decl as { values: string[] }).values;
        }
        return entry;
      })
      .sort((a, b) => a.key.localeCompare(b.key));
    return HttpResponse.json(entries);
  }),

  // GET /campaigns/:id/state
  http.get(`${base}/campaigns/:id/state`, ({ params }) => {
    const campaignId = params['id'] as string;
    const schema = getGlobalSchema(campaignId);
    const overrides = getOverrideMap(`campaign:${campaignId}`);
    const entries: StateEntryDto[] = Array.from(schema.entries())
      .map(([key, decl]) => {
        const current = overrides.has(key) ? overrides.get(key)! : decl.default;
        const entry: StateEntryDto = {
          key,
          type: decl.type,
          default: decl.default,
          current: current as StateEntryDto['current'],
        };
        if (decl.values) entry.values = decl.values;
        return entry;
      })
      .sort((a, b) => a.key.localeCompare(b.key));
    return HttpResponse.json(entries);
  }),

  // GET /campaigns/:id/global-schema
  http.get(`${base}/campaigns/:id/global-schema`, ({ params }) => {
    const campaignId = params['id'] as string;
    const schema = getGlobalSchema(campaignId);
    const result: Record<string, GlobalVarDecl> = {};
    for (const [name, decl] of schema) {
      result[name] = { type: decl.type, default: decl.default };
      if (decl.values) result[name].values = decl.values;
    }
    return HttpResponse.json(result);
  }),

  // POST /campaigns/:id/global-schema
  http.post(`${base}/campaigns/:id/global-schema`, async ({ params, request }) => {
    const campaignId = params['id'] as string;
    const body = (await request.json().catch(() => null)) as ({ name: string } & GlobalVarDecl) | null;
    if (!body?.name || !body.type) {
      return HttpResponse.json({ message: 'Invalid body' }, { status: 400 });
    }
    const schema = getGlobalSchema(campaignId);
    if (schema.has(body.name)) {
      return HttpResponse.json({ message: 'Variable already exists' }, { status: 409 });
    }
    const decl: GlobalVarDecl = { type: body.type, default: body.default };
    if (body.values) decl.values = body.values;
    schema.set(body.name, decl);
    return new HttpResponse(null, { status: 201 });
  }),

  // PATCH /campaigns/:id/global-schema/:name
  http.patch(`${base}/campaigns/:id/global-schema/:name`, async ({ params, request }) => {
    const campaignId = params['id'] as string;
    const name = params['name'] as string;
    const body = (await request.json().catch(() => null)) as Partial<GlobalVarDecl> | null;
    const schema = getGlobalSchema(campaignId);
    if (!schema.has(name)) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const existing = schema.get(name)!;
    const updated: GlobalVarDecl = { ...existing, ...body };
    schema.set(name, updated);
    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /campaigns/:id/global-schema/:name
  http.delete(`${base}/campaigns/:id/global-schema/:name`, ({ params }) => {
    const campaignId = params['id'] as string;
    const name = params['name'] as string;
    const schema = getGlobalSchema(campaignId);
    if (!schema.has(name)) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    schema.delete(name);
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /terminals/:id/state/mutate
  http.post(`${base}/terminals/:id/state/mutate`, async ({ params, request }) => {
    const id = params['id'] as string;
    const record = terminalsStore.get(id);
    if (!record) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const body = (await request.json().catch(() => null)) as { mutations?: unknown[] } | null;
    if (!body?.mutations) {
      return HttpResponse.json({ message: 'Invalid body' }, { status: 400 });
    }
    const local = record.content.state.local;
    const overrides = getOverrideMap(`terminal:${id}`);
    // Validate all atoms before applying any
    for (const atom of body.mutations as { key: string; op: string; value?: unknown; by?: unknown }[]) {
      const rawKey = atom.key;
      const varName = rawKey.startsWith('local.') ? rawKey.slice(6) : rawKey;
      const decl = local[varName];
      if (!decl) {
        return HttpResponse.json({ message: `Undeclared variable: ${varName}` }, { status: 422 });
      }
      if (atom.op === 'set' && !typeCheckValue(decl.type, atom.value)) {
        return HttpResponse.json(
          { message: `Type mismatch for ${varName}: expected ${decl.type}` },
          { status: 422 },
        );
      }
      if (atom.op === 'increment' && decl.type !== 'number') {
        return HttpResponse.json(
          { message: `Cannot increment non-number variable ${varName}` },
          { status: 422 },
        );
      }
      if (atom.op === 'increment' && typeof atom.by !== 'number') {
        return HttpResponse.json(
          { message: `increment requires a numeric 'by' field` },
          { status: 422 },
        );
      }
    }
    // Apply all atoms
    for (const atom of body.mutations as { key: string; op: string; value?: unknown; by?: unknown }[]) {
      const varName = atom.key.startsWith('local.') ? atom.key.slice(6) : atom.key;
      const decl = local[varName];
      const currentVal = overrides.has(varName) ? overrides.get(varName) : decl.default;
      applyAtom(overrides, varName, atom.op, atom.value, atom.by, currentVal);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /campaigns/:id/state/mutate
  http.post(`${base}/campaigns/:id/state/mutate`, async ({ params, request }) => {
    const campaignId = params['id'] as string;
    const body = (await request.json().catch(() => null)) as { mutations?: unknown[] } | null;
    if (!body?.mutations) {
      return HttpResponse.json({ message: 'Invalid body' }, { status: 400 });
    }
    const globalDecls = getGlobalSchema(campaignId);
    const overrides = getOverrideMap(`campaign:${campaignId}`);
    // Validate all atoms before applying any
    for (const atom of body.mutations as { key: string; op: string; value?: unknown; by?: unknown }[]) {
      const varName = atom.key.startsWith('global.') ? atom.key.slice(7) : atom.key;
      const decl = globalDecls.get(varName);
      if (!decl) {
        return HttpResponse.json({ message: `Undeclared variable: ${varName}` }, { status: 422 });
      }
      if (atom.op === 'set' && !typeCheckValue(decl.type, atom.value)) {
        return HttpResponse.json(
          { message: `Type mismatch for ${varName}: expected ${decl.type}` },
          { status: 422 },
        );
      }
      if (atom.op === 'increment' && decl.type !== 'number') {
        return HttpResponse.json(
          { message: `Cannot increment non-number variable ${varName}` },
          { status: 422 },
        );
      }
    }
    // Apply all atoms
    for (const atom of body.mutations as { key: string; op: string; value?: unknown; by?: unknown }[]) {
      const varName = atom.key.startsWith('global.') ? atom.key.slice(7) : atom.key;
      const decl = globalDecls.get(varName)!;
      const currentVal = overrides.has(varName) ? overrides.get(varName) : decl.default;
      applyAtom(overrides, varName, atom.op, atom.value, atom.by, currentVal);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /terminals/:id/state/:key/reset  (per-variable)
  // Note: must be registered before /terminals/:id/state/reset to avoid conflict
  http.post(`${base}/terminals/:id/state/:key/reset`, ({ params }) => {
    const id = params['id'] as string;
    const key = params['key'] as string;
    if (!terminalsStore.has(id)) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const overrides = getOverrideMap(`terminal:${id}`);
    overrides.delete(key);
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /terminals/:id/state/reset  (all-local)
  http.post(`${base}/terminals/:id/state/reset`, ({ params }) => {
    const id = params['id'] as string;
    if (!terminalsStore.has(id)) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    currentValues.delete(`terminal:${id}`);
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /campaigns/:id/state/:key/reset  (per-variable)
  http.post(`${base}/campaigns/:id/state/:key/reset`, ({ params }) => {
    const id = params['id'] as string;
    const key = params['key'] as string;
    const overrides = getOverrideMap(`campaign:${id}`);
    overrides.delete(key);
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /campaigns/:id/state/reset  (all-global only, per D5)
  http.post(`${base}/campaigns/:id/state/reset`, ({ params }) => {
    const id = params['id'] as string;
    currentValues.delete(`campaign:${id}`);
    return new HttpResponse(null, { status: 204 });
  }),
];
