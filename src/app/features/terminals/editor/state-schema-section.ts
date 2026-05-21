import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { emptyStateVarGroup } from './terminal-form';

@Component({
  selector: 'app-state-schema-section',
  standalone: true,
  imports: [ReactiveFormsModule, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bo-card section">
      <h3 class="section-title">Schema di stato</h3>

      <div class="scope-block">
        <h4 class="scope-label">Variabili Locali</h4>
        <ng-container *ngTemplateOutlet="varList; context: { $implicit: localVars }"></ng-container>
        @if (localVars.errors?.['duplicateNames']) {
          <span class="field-error">I nomi delle variabili locali devono essere unici</span>
        }
        <button type="button" class="bo-btn ghost sm" (click)="addVar(localVars)">+ Aggiungi variabile locale</button>
      </div>

      <div class="scope-block">
        <h4 class="scope-label">Variabili Globali</h4>
        <ng-container *ngTemplateOutlet="varList; context: { $implicit: globalVars }"></ng-container>
        @if (globalVars.errors?.['duplicateNames']) {
          <span class="field-error">I nomi delle variabili globali devono essere unici</span>
        }
        <button type="button" class="bo-btn ghost sm" (click)="addVar(globalVars)">+ Aggiungi variabile globale</button>
      </div>
    </div>

    <ng-template #varList let-arr>
      @for (row of arr.controls; track row; let i = $index) {
        <div [formGroup]="asGroup(row)" class="var-row">
          <input formControlName="name" placeholder="nome" class="bo-input sm" />
          <select formControlName="type" class="bo-select sm">
            <option value="boolean">boolean</option>
            <option value="number">number</option>
            <option value="string">string</option>
            <option value="enum">enum</option>
          </select>

          @if (asGroup(row).get('type')?.value === 'boolean') {
            <select formControlName="default" class="bo-select sm">
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          } @else if (asGroup(row).get('type')?.value === 'number') {
            <input formControlName="default" type="number" placeholder="default" class="bo-input sm" />
          } @else if (asGroup(row).get('type')?.value === 'enum') {
            <input formControlName="values" placeholder="val1,val2,..." class="bo-input sm" />
            <select formControlName="default" class="bo-select sm">
              @for (v of enumValues(asGroup(row)); track v) {
                <option [value]="v">{{ v }}</option>
              }
            </select>
          } @else {
            <input formControlName="default" placeholder="default" class="bo-input sm" />
          }

          <button type="button" class="bo-btn ghost sm danger" (click)="removeVar(arr, i)">✕</button>
        </div>
      }
    </ng-template>
  `,
  styles: [`
    .section { margin-bottom: 16px; padding: 16px; }
    .section-title { margin: 0 0 12px; font-size: 14px; font-weight: 600; text-transform: uppercase; color: var(--bo-text-faint); }
    .scope-block { margin-bottom: 16px; }
    .scope-label { font-size: 13px; font-weight: 600; margin: 0 0 8px; }
    .var-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
    .bo-input.sm, .bo-select.sm { padding: 4px 8px; font-size: 13px; }
    .bo-btn.sm { padding: 4px 10px; font-size: 13px; }
    .danger { color: var(--bo-danger, #c0392b); }
    .field-error { font-size: 12px; color: var(--bo-danger, #c0392b); display: block; margin-bottom: 4px; }
  `],
})
export class StateSchemaSectionComponent {
  @Input({ required: true }) localVars!: FormArray<FormGroup>;
  @Input({ required: true }) globalVars!: FormArray<FormGroup>;

  addVar(arr: FormArray<FormGroup>): void {
    arr.push(emptyStateVarGroup());
  }

  removeVar(arr: FormArray<FormGroup>, i: number): void {
    arr.removeAt(i);
  }

  enumValues(group: FormGroup): string[] {
    const raw = group.get('values')?.value as string ?? '';
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  asGroup(c: unknown): FormGroup {
    return c as FormGroup;
  }
}
