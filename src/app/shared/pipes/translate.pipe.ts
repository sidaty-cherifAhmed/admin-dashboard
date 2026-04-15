import { ChangeDetectorRef, Pipe, PipeTransform, inject } from '@angular/core';

import { I18nService } from '../../core/services/i18n.service';

@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  private readonly cdr = inject(ChangeDetectorRef);
  private lastLanguage = this.i18n.language();

  transform(key: string, params?: Record<string, string | number>): string {
    const language = this.i18n.language();
    if (language !== this.lastLanguage) {
      this.lastLanguage = language;
      queueMicrotask(() => this.cdr.markForCheck());
    }

    return this.i18n.t(key, params);
  }
}
