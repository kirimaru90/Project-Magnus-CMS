import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, EMPTY, switchMap } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import { TerminalsApiService } from '../../core/terminal/terminals-api.service';
import { exportTerminal } from './export-terminal';

@Component({
  selector: 'app-terminal-detail',
  standalone: true,
  imports: [RouterLink, Toast],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />

    <div class="bo-page">
      @if (notFound()) {
        <div class="bo-card" style="text-align: center; color: var(--bo-text-faint); padding: 32px;">
          <p>Terminale non trovato.</p>
          <a routerLink="/campaigns" class="bo-btn ghost" style="margin-top: 12px; display: inline-block;">
            Torna alle campagne
          </a>
        </div>
      } @else if (terminal(); as t) {
        <div class="bo-page-head">
          <div>
            @if (backLink()) {
              <a [routerLink]="backLink()" style="font-size: 12px; color: var(--bo-text-faint); text-decoration: none;">
                ← Torna ai terminali
              </a>
            }
            <h1>{{ t.meta.title }}</h1>
          </div>
          <button type="button" class="bo-btn ghost" (click)="onExport()">
            Esporta
          </button>
        </div>

        <div class="bo-card" style="margin-bottom: 16px;">
          <table style="border-collapse: collapse; width: 100%;">
            <tr>
              <td style="padding: 9px 12px; color: var(--bo-text-faint); white-space: nowrap; width: 1%;">Visibilità</td>
              <td style="padding: 9px 12px 9px 0;">
                <span class="bo-pill" [class.active]="t.meta.public">
                  {{ t.meta.public ? 'Pubblico' : 'Privato' }}
                </span>
              </td>
            </tr>
            @if (campaignName()) {
              <tr>
                <td style="padding: 9px 12px; color: var(--bo-text-faint); white-space: nowrap; width: 1%;">Campagna</td>
                <td style="padding: 9px 12px 9px 0;">{{ campaignName() }}</td>
              </tr>
            }
            @if (t.meta.id) {
              <tr>
                <td style="padding: 9px 12px; color: var(--bo-text-faint); white-space: nowrap; width: 1%;">ID</td>
                <td style="padding: 9px 12px 9px 0; font-family: monospace;">{{ t.meta.id }}</td>
              </tr>
            }
          </table>
        </div>

        <div class="bo-card" style="padding: 32px; text-align: center; color: var(--bo-text-faint); border: 2px dashed var(--bo-border);">
          Editor del contenuto disponibile nello Slice 5
        </div>
      } @else {
        <div class="bo-card" style="text-align: center; color: var(--bo-text-faint); padding: 32px;">
          Caricamento…
        </div>
      }
    </div>
  `,
})
export class TerminalDetailPage {
  private readonly terminalsApi = inject(TerminalsApiService);
  private readonly currentCampaign = inject(CurrentCampaignService);
  private readonly messageService = inject(MessageService);
  private readonly route = inject(ActivatedRoute);

  private readonly terminalId = this.route.snapshot.params['id'] as string;

  protected readonly notFound = signal(false);

  protected readonly terminal = toSignal(
    this.terminalsApi.get(this.terminalId).pipe(
      catchError((err) => {
        if (err?.status === 404) {
          this.notFound.set(true);
        }
        return EMPTY;
      }),
    ),
  );

  protected readonly campaignName = toSignal(
    this.terminalsApi.get(this.terminalId).pipe(
      switchMap(() => {
        const campaign = this.currentCampaign.currentCampaign();
        return campaign ? [campaign.name] : [null];
      }),
      catchError(() => [null]),
    ),
  );

  protected readonly backLink = (() => {
    const campaign = this.currentCampaign.currentCampaign();
    return signal(campaign ? `/campaigns/${campaign.id}/terminals` : null);
  })();

  protected onExport(): void {
    exportTerminal(this.terminalsApi, this.messageService, this.terminalId);
  }
}
