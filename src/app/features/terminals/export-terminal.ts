import { MessageService } from 'primeng/api';
import type { TerminalsApiService } from '../../core/terminal/terminals-api.service';

export function exportTerminal(
  api: TerminalsApiService,
  messageService: MessageService,
  terminalId: string,
): void {
  api.export(terminalId).subscribe({
    next: (content) => {
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${content.meta.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    error: () => {
      messageService.add({ severity: 'error', summary: 'Errore durante l\'esportazione' });
    },
  });
}
