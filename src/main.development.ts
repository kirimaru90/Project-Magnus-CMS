import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { worker } from './mocks/browser';

worker
  .start({ onUnhandledRequest: 'bypass' })
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => console.error(err));
