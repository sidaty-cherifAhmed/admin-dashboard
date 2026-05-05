import { bootstrapApplication } from '@angular/platform-browser';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { AppPaginatorIntl } from './app/core/i18n/paginator-intl';

bootstrapApplication(App, {
  ...appConfig,
  providers: [...(appConfig.providers ?? []), { provide: MatPaginatorIntl, useClass: AppPaginatorIntl }],
}).catch(err => console.error(err));

