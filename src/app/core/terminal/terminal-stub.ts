import { TerminalContent, TerminalContentSchema } from '../../domain/terminal-schema';

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || crypto.randomUUID();
}

export function buildTerminalStub(opts: { title: string; public: boolean }): TerminalContent {
  const stub = {
    meta: { id: slugify(opts.title), title: opts.title, public: opts.public },
    state: { local: {}, global: {} },
    login: { users: [] },
    nodes: {
      start: { text: 'Inserisci il testo del nodo di partenza...', choices: [] },
    },
  };

  const result = TerminalContentSchema.safeParse(stub);
  if (!result.success) {
    throw new Error('buildTerminalStub: schema validation failed — ' + JSON.stringify(result.error.issues));
  }
  return result.data;
}
