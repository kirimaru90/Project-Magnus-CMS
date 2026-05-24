import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CampaignGlobalSchemaApiService } from '../../core/state/campaign-global-schema-api.service';
import type { GlobalSchemaDto, GlobalVarDecl } from '../../core/state/state.types';

interface VarRow {
  name: string;
  type: GlobalVarDecl['type'];
  default: GlobalVarDecl['default'];
  values?: string[];
  editing: boolean;
}

@Component({
  selector: 'app-campaign-global-schema-panel',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bo-card" style="margin-top: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h2 style="margin: 0;">Schema variabili globali</h2>
      </div>

      @if (rows().length === 0 && !showAddForm()) {
        <p style="color: var(--bo-text-faint); font-size: 14px;">Nessuna variabile globale definita.</p>
      }

      @for (row of rows(); track row.name; let i = $index) {
        <div class="var-row">
          @if (row.editing) {
            <!-- Inline edit form -->
            <span class="var-name">{{ row.name }}</span>
            <select [value]="editGroup.get('type')!.value" (change)="onEditTypeChange($event)" class="bo-select sm">
              <option value="boolean">boolean</option>
              <option value="number">number</option>
              <option value="string">string</option>
              <option value="enum">enum</option>
            </select>
            @if (editGroup.get('type')!.value === 'boolean') {
              <select formControlName="default" [formGroup]="editGroup" class="bo-select sm">
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            } @else if (editGroup.get('type')!.value === 'number') {
              <input [formGroup]="editGroup" formControlName="default" type="number" placeholder="default" class="bo-input sm" />
            } @else if (editGroup.get('type')!.value === 'enum') {
              <input [formGroup]="editGroup" formControlName="values" placeholder="val1,val2,..." class="bo-input sm" />
              <input [formGroup]="editGroup" formControlName="default" placeholder="default" class="bo-input sm" />
            } @else {
              <input [formGroup]="editGroup" formControlName="default" placeholder="default" class="bo-input sm" />
            }
            <button type="button" class="bo-btn ghost sm" (click)="saveEdit(i)">Salva</button>
            <button type="button" class="bo-btn ghost sm" (click)="cancelEdit(i)">Annulla</button>
          } @else {
            <!-- Read-only display -->
            <span class="var-name">{{ row.name }}</span>
            <span class="var-badge">{{ row.type }}</span>
            <span class="var-default">default: {{ row.default }}</span>
            @if (row.values?.length) {
              <span class="var-values">[{{ row.values!.join(', ') }}]</span>
            }
            <button type="button" class="bo-btn ghost sm" (click)="startEdit(i)">Modifica</button>
            <button type="button" class="bo-btn ghost sm danger" (click)="deleteVar(row.name)">✕</button>
          }
        </div>
      }

      @if (showAddForm()) {
        <div class="add-form" [formGroup]="addGroup">
          <input formControlName="name" placeholder="nome variabile" class="bo-input sm" />
          <select formControlName="type" class="bo-select sm" (change)="onAddTypeChange()">
            <option value="boolean">boolean</option>
            <option value="number">number</option>
            <option value="string">string</option>
            <option value="enum">enum</option>
          </select>
          @if (addGroup.get('type')!.value === 'boolean') {
            <select formControlName="default" class="bo-select sm">
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          } @else if (addGroup.get('type')!.value === 'number') {
            <input formControlName="default" type="number" placeholder="default" class="bo-input sm" />
          } @else if (addGroup.get('type')!.value === 'enum') {
            <input formControlName="values" placeholder="val1,val2,..." class="bo-input sm" />
            <input formControlName="default" placeholder="default" class="bo-input sm" />
          } @else {
            <input formControlName="default" placeholder="default" class="bo-input sm" />
          }
          <button type="button" class="bo-btn primary sm" (click)="submitAdd()">Aggiungi</button>
          <button type="button" class="bo-btn ghost sm" (click)="showAddForm.set(false)">Annulla</button>
          @if (addGroup.get('name')?.errors?.['required'] && addGroup.get('name')?.touched) {
            <span class="field-error">Il nome è obbligatorio</span>
          }
        </div>
      } @else {
        <button type="button" class="bo-btn ghost sm" (click)="openAddForm()" style="margin-top: 8px;">
          + Aggiungi variabile globale
        </button>
      }
    </div>
  `,
  styles: [`
    .var-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; padding: 8px; background: var(--bo-panel-sunk); border-radius: 6px; }
    .var-name { font-weight: 600; font-size: 13px; min-width: 80px; }
    .var-badge { font-size: 11px; background: var(--bo-panel-2); color: var(--bo-text-muted); border: 1px solid var(--bo-border); border-radius: 4px; padding: 2px 6px; }
    .var-default { font-size: 13px; color: var(--bo-text-faint); }
    .var-values { font-size: 12px; color: var(--bo-text-faint); font-family: monospace; }
    .add-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; padding: 10px; border: 1px dashed var(--bo-border); border-radius: 6px; }
    .bo-input.sm, .bo-select.sm { padding: 4px 8px; font-size: 13px; }
    .bo-btn.sm { padding: 4px 10px; font-size: 13px; }
    .danger { color: var(--bo-danger, #c0392b); }
    .field-error { font-size: 12px; color: var(--bo-danger, #c0392b); }
  `],
})
export class CampaignGlobalSchemaPanelComponent implements OnInit {
  @Input({ required: true }) campaignId!: string;

  private readonly schemaApi = inject(CampaignGlobalSchemaApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly rows = signal<VarRow[]>([]);
  protected readonly showAddForm = signal(false);

  protected addGroup = this.makeAddGroup();
  protected editGroup = this.makeEditGroup();

  private editOriginal: VarRow | null = null;

  ngOnInit(): void {
    this.loadSchema();
  }

  private loadSchema(): void {
    this.schemaApi.getSchema(this.campaignId).subscribe({
      next: (schema) => this.rows.set(this.schemaToRows(schema)),
      error: () => this.messageService.add({ severity: 'error', summary: 'Errore caricamento schema' }),
    });
  }

  private schemaToRows(schema: GlobalSchemaDto): VarRow[] {
    return Object.entries(schema).map(([name, decl]) => ({
      name,
      type: decl.type,
      default: decl.default,
      values: decl.values,
      editing: false,
    }));
  }

  private makeAddGroup(): FormGroup {
    return new FormGroup({
      name: new FormControl('', Validators.required),
      type: new FormControl<GlobalVarDecl['type']>('string'),
      default: new FormControl(''),
      values: new FormControl(''),
    });
  }

  private makeEditGroup(): FormGroup {
    return new FormGroup({
      type: new FormControl<GlobalVarDecl['type']>('string'),
      default: new FormControl(''),
      values: new FormControl(''),
    });
  }

  protected openAddForm(): void {
    this.addGroup = this.makeAddGroup();
    this.showAddForm.set(true);
  }

  protected onAddTypeChange(): void {
    this.addGroup.get('default')?.setValue('');
    this.addGroup.get('values')?.setValue('');
  }

  protected submitAdd(): void {
    this.addGroup.markAllAsTouched();
    if (this.addGroup.invalid) return;
    const raw = this.addGroup.getRawValue() as { name: string; type: GlobalVarDecl['type']; default: string; values: string };
    const decl = this.buildDecl(raw.type, raw.default, raw.values);
    this.schemaApi.addVar(this.campaignId, raw.name.trim(), decl).subscribe({
      next: () => {
        this.showAddForm.set(false);
        this.loadSchema();
        this.messageService.add({ severity: 'success', summary: 'Variabile aggiunta' });
      },
      error: (err: { status?: number }) => {
        const msg = err?.status === 409 ? 'Variabile già esistente' : 'Errore durante l\'aggiunta';
        this.messageService.add({ severity: 'error', summary: msg });
      },
    });
  }

  protected startEdit(i: number): void {
    const current = this.rows();
    const row = current[i];
    this.editOriginal = { ...row };
    this.editGroup = new FormGroup({
      type: new FormControl<GlobalVarDecl['type']>(row.type),
      default: new FormControl(String(row.default)),
      values: new FormControl(row.values?.join(',') ?? ''),
    });
    this.rows.update((r) => r.map((item, idx) => ({ ...item, editing: idx === i })));
  }

  protected onEditTypeChange(event: Event): void {
    const type = (event.target as HTMLSelectElement).value as GlobalVarDecl['type'];
    this.editGroup.get('type')?.setValue(type);
    this.editGroup.get('default')?.setValue('');
    this.editGroup.get('values')?.setValue('');
  }

  protected saveEdit(i: number): void {
    const row = this.rows()[i];
    const raw = this.editGroup.getRawValue() as { type: GlobalVarDecl['type']; default: string; values: string };
    const decl = this.buildDecl(raw.type, raw.default, raw.values);
    this.schemaApi.updateVar(this.campaignId, row.name, decl).subscribe({
      next: () => {
        this.loadSchema();
        this.messageService.add({ severity: 'success', summary: 'Variabile aggiornata' });
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Errore durante l\'aggiornamento' }),
    });
  }

  protected cancelEdit(i: number): void {
    this.rows.update((r) => r.map((item, idx) => ({ ...item, editing: idx === i ? false : item.editing })));
    this.editOriginal = null;
  }

  protected deleteVar(name: string): void {
    this.confirmationService.confirm({
      message: `Eliminare la variabile globale "${name}"? Sarà rimossa dalla campagna.`,
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.schemaApi.deleteVar(this.campaignId, name).subscribe({
          next: () => {
            this.loadSchema();
            this.messageService.add({ severity: 'success', summary: 'Variabile eliminata' });
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Errore durante l\'eliminazione' }),
        });
      },
    });
  }

  private buildDecl(
    type: GlobalVarDecl['type'],
    defaultStr: string,
    valuesStr: string,
  ): GlobalVarDecl {
    if (type === 'boolean') {
      return { type, default: defaultStr === 'true' };
    }
    if (type === 'number') {
      return { type, default: Number(defaultStr) };
    }
    if (type === 'enum') {
      const values = valuesStr.split(',').map((s) => s.trim()).filter(Boolean);
      return { type, default: defaultStr, values };
    }
    return { type, default: defaultStr };
  }
}
