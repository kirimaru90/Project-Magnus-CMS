import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { StateApiService } from '../../core/state/state-api.service';
import { CampaignGlobalSchemaApiService } from '../../core/state/campaign-global-schema-api.service';
import type { GlobalVarDecl, MutationAtom, StateEntryDto } from '../../core/state/state.types';
import { TerminalsApiService } from '../../core/terminal/terminals-api.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';
import { StateTableComponent } from '../state/state-table';
import { ResetConfirmComponent } from '../state/reset-confirm';

@Component({
  selector: 'app-campaign-state-panel',
  standalone: true,
  imports: [ButtonModule, StateTableComponent, ResetConfirmComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-reset-confirm
      [campaignName]="campaign.name"
      [visible]="showResetConfirm()"
      (confirmed)="executeEntireCampaignReset()"
      (cancelled)="showResetConfirm.set(false)"
    />

    <div class="bo-card" style="margin-top: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h2 style="margin: 0;">Stato globale</h2>
        <div style="display: flex; gap: 8px;">
          @if (entries().length > 0) {
            <button type="button" class="bo-btn ghost danger" (click)="confirmResetGlobal()">
              Reset globale ({{ entries().length }})
            </button>
          }
          <button
            type="button"
            class="bo-btn ghost danger"
            style="border-color: var(--p-red-600, #dc2626); color: var(--p-red-600, #dc2626);"
            (click)="showResetConfirm.set(true)"
          >
            Reset intera campagna
          </button>
        </div>
      </div>

      <app-state-table
        [entries]="entries()"
        scope="global"
        emptyMessage="Nessuna variabile globale dichiarata"
        [allowSchemaAdd]="true"
        [allowSchemaDelete]="true"
        (mutate)="onMutate($event)"
        (resetVar)="onResetVar($event)"
        (schemaChange)="onSchemaChange($event)"
        (addVar)="onAddVar($event)"
        (deleteVar)="onDeleteVar($event)"
      />
    </div>
  `,
})
export class CampaignStatePanelComponent implements OnInit {
  @Input({ required: true }) campaign!: CampaignDto;

  private readonly stateApi = inject(StateApiService);
  private readonly schemaApi = inject(CampaignGlobalSchemaApiService);
  private readonly terminalsApi = inject(TerminalsApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly entries = signal<StateEntryDto[]>([]);
  protected readonly showResetConfirm = signal(false);

  ngOnInit(): void {
    this.loadState();
  }

  private loadState(): void {
    this.stateApi.getCampaignState(this.campaign.id).subscribe({
      next: (e) => this.entries.set(e),
      error: () =>
        this.messageService.add({ severity: 'error', summary: 'Errore caricamento stato' }),
    });
  }

  protected onMutate(atom: MutationAtom): void {
    this.stateApi.mutateCampaign(this.campaign.id, [atom]).subscribe({
      next: () => this.loadState(),
      error: () =>
        this.messageService.add({ severity: 'error', summary: 'Errore durante la modifica' }),
    });
  }

  protected onSchemaChange(event: { old: StateEntryDto; entry: StateEntryDto }): void {
    const { old, entry } = event;
    const isRename = old.key !== entry.key;
    const isTypeChange = !isRename && old.type !== entry.type;

    const decl: GlobalVarDecl = {
      type: entry.type,
      default: entry.default,
      ...(entry.values ? { values: entry.values } : {}),
    };

    if (isRename) {
      // rename = delete old + add new
      this.schemaApi
        .deleteVar(this.campaign.id, old.key)
        .pipe(switchMap(() => this.schemaApi.addVar(this.campaign.id, entry.key, decl)))
        .subscribe({
          next: () => {
            this.loadState();
            this.messageService.add({ severity: 'success', summary: 'Variabile rinominata' });
          },
          error: (err: { status?: number }) => {
            const msg =
              err?.status === 409 ? 'Variabile già esistente' : 'Errore durante la rinomina';
            this.messageService.add({ severity: 'error', summary: msg });
          },
        });
    } else if (isTypeChange) {
      // update declaration, then clear stale override
      this.schemaApi
        .updateVar(this.campaign.id, old.key, decl)
        .pipe(switchMap(() => this.stateApi.resetCampaignVar(this.campaign.id, old.key)))
        .subscribe({
          next: () => {
            this.loadState();
            this.messageService.add({ severity: 'success', summary: 'Variabile aggiornata' });
          },
          error: () =>
            this.messageService.add({ severity: 'error', summary: "Errore durante l'aggiornamento" }),
        });
    } else {
      // default/values-only edit
      this.schemaApi.updateVar(this.campaign.id, old.key, decl).subscribe({
        next: () => {
          this.loadState();
          this.messageService.add({ severity: 'success', summary: 'Variabile aggiornata' });
        },
        error: () =>
          this.messageService.add({ severity: 'error', summary: "Errore durante l'aggiornamento" }),
      });
    }
  }

  protected onAddVar(entry: StateEntryDto): void {
    const decl: GlobalVarDecl = {
      type: entry.type,
      default: entry.default,
      ...(entry.values ? { values: entry.values } : {}),
    };
    this.schemaApi.addVar(this.campaign.id, entry.key, decl).subscribe({
      next: () => {
        this.loadState();
        this.messageService.add({ severity: 'success', summary: 'Variabile aggiunta' });
      },
      error: (err: { status?: number }) => {
        const msg = err?.status === 409 ? 'Variabile già esistente' : "Errore durante l'aggiunta";
        this.messageService.add({ severity: 'error', summary: msg });
      },
    });
  }

  protected onDeleteVar(entry: StateEntryDto): void {
    this.confirmationService.confirm({
      message: `Eliminare la variabile globale "${entry.key}"? Sarà rimossa dalla campagna.`,
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.schemaApi.deleteVar(this.campaign.id, entry.key).subscribe({
          next: () => {
            this.loadState();
            this.messageService.add({ severity: 'success', summary: 'Variabile eliminata' });
          },
          error: () =>
            this.messageService.add({ severity: 'error', summary: "Errore durante l'eliminazione" }),
        });
      },
    });
  }

  protected onResetVar(entry: StateEntryDto): void {
    this.confirmationService.confirm({
      message: `Ripristinare la variabile "${entry.key}" al valore di default (${entry.default})?`,
      acceptLabel: 'Ripristina',
      rejectLabel: 'Annulla',
      accept: () => {
        this.stateApi.resetCampaignVar(this.campaign.id, entry.key).subscribe({
          next: () => this.loadState(),
          error: () =>
            this.messageService.add({ severity: 'error', summary: 'Errore durante il reset' }),
        });
      },
    });
  }

  protected confirmResetGlobal(): void {
    this.confirmationService.confirm({
      message: `Ripristinare tutte le ${this.entries().length} variabili globali ai valori di default?`,
      acceptLabel: 'Ripristina tutto',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        this.stateApi.resetCampaignAll(this.campaign.id).subscribe({
          next: () => this.loadState(),
          error: () =>
            this.messageService.add({ severity: 'error', summary: 'Errore durante il reset globale' }),
        });
      },
    });
  }

  protected executeEntireCampaignReset(): void {
    this.showResetConfirm.set(false);
    // Step 1: global reset first; abort on failure
    this.stateApi
      .resetCampaignAll(this.campaign.id)
      .pipe(
        switchMap(() =>
          // Step 2: fan-out per-terminal local resets in parallel
          this.terminalsApi.listByCampaign(this.campaign.id).pipe(
            switchMap((terminals) => {
              if (terminals.length === 0) return of({ successes: 0, failures: [] as string[] });
              const resets = terminals.map((t) =>
                this.stateApi.resetTerminalAll(t.id).pipe(
                  catchError(() => {
                    return of({ failed: t.id });
                  }),
                ),
              );
              return forkJoin(resets).pipe(
                switchMap((results) => {
                  const failures = results
                    .filter((r): r is { failed: string } => r !== null && typeof r === 'object' && 'failed' in r)
                    .map((r) => r.failed);
                  return of({ successes: terminals.length - failures.length, failures });
                }),
              );
            }),
          ),
        ),
        catchError((err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Reset globale fallito',
            detail: 'Nessun terminale locale è stato resettato.',
          });
          throw err;
        }),
      )
      .subscribe(({ successes, failures }) => {
        this.loadState();
        if (failures.length === 0) {
          this.messageService.add({
            severity: 'success',
            summary: `Reset completato`,
            detail: `Stato globale + ${successes} terminal${successes !== 1 ? 'i' : 'e'} locale${successes !== 1 ? 'i' : ''} resettati.`,
          });
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: `Reset parziale`,
            detail: `${successes} terminali resettati. Errori: ${failures.join(', ')}`,
          });
        }
      });
  }
}
