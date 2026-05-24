export interface StateEntryDto {
  key: string;
  type: 'boolean' | 'number' | 'enum' | 'string';
  default: boolean | number | string;
  current: boolean | number | string;
  values?: string[];
}

export type StateScope = 'local' | 'global';

export interface MutationAtom {
  key: string;
  op: 'set' | 'increment' | 'toggle';
  value?: unknown;
  by?: number;
}

export interface MutateStateBody {
  mutations: MutationAtom[];
}

export interface GlobalVarDecl {
  type: 'boolean' | 'number' | 'string' | 'enum';
  default: boolean | number | string;
  values?: string[];
}

export type GlobalSchemaDto = Record<string, GlobalVarDecl>;
