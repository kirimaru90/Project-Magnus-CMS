import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { MessageService } from 'primeng/api';
import { Dialog } from 'primeng/dialog';
import { FileUpload, FileSelectEvent } from 'primeng/fileupload';
import { TerminalsApiService } from '../../core/terminal/terminals-api.service';
import type { TerminalDto } from '../../core/terminal/terminal.types';
import { TerminalContentSchema } from '../../domain/terminal-schema';

interface ZodError {
  path: string;
  message: string;
}

@Component({
  selector: 'app-import-terminal-dialog',
  standalone: true,
  imports: [Dialog, FileUpload],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      header="Importa terminale"
      [modal]="true"
      [style]="{ width: '480px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <p-fileupload
        mode="basic"
        accept=".json,application/json"
        [maxFileSize]="1048576"
        chooseLabel="Scegli file JSON"
        [auto]="false"
        [customUpload]="true"
        (onSelect)="onFileSelect($event)"
      />

      @if (parseError()) {
        <div class="bo-field-error" style="margin-top: 12px;">{{ parseError() }}</div>
      }

      @if (zodErrors().length > 0) {
        <div style="margin-top: 12px;">
          <div class="bo-field-error" style="margin-bottom: 4px;">Il file non è un terminale valido:</div>
          <ul style="max-height: 40vh; overflow-y: auto; margin: 0; padding-left: 20px; font-size: 12px;">
            @for (err of zodErrors(); track $index) {
              <li>{{ err.path }}: {{ err.message }}</li>
            }
          </ul>
        </div>
      }

      @if (apiError()) {
        <div class="bo-field-error" style="margin-top: 12px;">{{ apiError() }}</div>
      }

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <button type="button" class="bo-btn ghost" (click)="closed.emit()">Chiudi</button>
      </div>
    </p-dialog>
  `,
})
export class ImportTerminalDialogComponent {
  @Input() visible = false;
  @Input() campaignId = '';
  @Output() closed = new EventEmitter<void>();
  @Output() imported = new EventEmitter<TerminalDto>();

  private readonly api = inject(TerminalsApiService);
  private readonly messageService = inject(MessageService);

  protected readonly parseError = signal<string | null>(null);
  protected readonly zodErrors = signal<ZodError[]>([]);
  protected readonly apiError = signal<string | null>(null);

  protected onFileSelect(event: FileSelectEvent): void {
    this.parseError.set(null);
    this.zodErrors.set([]);
    this.apiError.set(null);

    const file = event.currentFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(reader.result as string);
      } catch {
        this.parseError.set('Il file non è un JSON valido.');
        return;
      }

      const result = TerminalContentSchema.safeParse(parsed);
      if (!result.success) {
        this.zodErrors.set(
          result.error.issues.map((issue) => ({
            path: issue.path.join('.') || '(root)',
            message: issue.message,
          })),
        );
        return;
      }

      this.api.import(this.campaignId, result.data).subscribe({
        next: (dto) => {
          this.messageService.add({ severity: 'success', summary: 'Terminale importato' });
          this.imported.emit(dto);
          this.closed.emit();
        },
        error: (err) => {
          const body = err?.error;
          const msg =
            typeof body?.message === 'string'
              ? body.message
              : 'Errore durante l\'importazione del terminale.';
          this.apiError.set(msg);
        },
      });
    };
    reader.readAsText(file);
  }
}
