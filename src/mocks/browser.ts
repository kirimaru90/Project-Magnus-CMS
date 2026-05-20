import { setupWorker } from 'msw/browser';
import { authHandlers } from './handlers/auth.handlers';
import { campaignsHandlers } from './handlers/campaigns.handlers';
import { terminalsHandlers } from './handlers/terminals.handlers';
import { usersHandlers } from './handlers/users.handlers';

export const worker = setupWorker(
  ...authHandlers,
  ...campaignsHandlers,
  ...terminalsHandlers,
  ...usersHandlers,
);
