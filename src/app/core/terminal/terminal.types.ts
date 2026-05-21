import type { TerminalMeta } from '../../domain/terminal-schema';

export interface TerminalDto {
  id: string;
  hiddenId?: string;
  meta: TerminalMeta;
  campaignId: string;
  views?: number;
  createdAt: string;
  updatedAt?: string;
}
