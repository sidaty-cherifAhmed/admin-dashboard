import { effect, Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

import { I18nService } from '../services/i18n.service';

@Injectable()
export class AppPaginatorIntl extends MatPaginatorIntl {
  constructor(private readonly i18n: I18nService) {
    super();

    effect(() => {
      this.i18n.language();
      this.itemsPerPageLabel = this.i18n.t('paginator.itemsPerPage');
      this.nextPageLabel = this.i18n.t('paginator.nextPage');
      this.previousPageLabel = this.i18n.t('paginator.previousPage');
      this.firstPageLabel = this.i18n.t('paginator.firstPage');
      this.lastPageLabel = this.i18n.t('paginator.lastPage');
      this.changes.next();
    });
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return this.i18n.t('paginator.rangeEmpty', { length });
    }

    const start = page * pageSize + 1;
    const end = Math.min(length, (page + 1) * pageSize);
    return this.i18n.t('paginator.range', { start, end, length });
  };
}
