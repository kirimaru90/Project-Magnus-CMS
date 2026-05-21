import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MarkdownComponent } from 'ngx-markdown';
import { ConditionBuilderComponent } from './condition-builder';
import { MutationEditorComponent } from './mutation-editor';
import {
  atMostOneDefaultValidator,
  makeBranchGroup,
  makeChoiceGroup,
  makeComponentGroup,
  makeVariantGroup,
} from './terminal-form';

@Component({
  selector: 'app-node-editor',
  standalone: true,
  imports: [ReactiveFormsModule, MarkdownComponent, MutationEditorComponent, ConditionBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [formGroup]="nodeGroup" class="node-editor">

      <!-- Node text + markdown preview -->
      <div class="two-col">
        <div class="field">
          <div class="field-label">Testo (Markdown)</div>
          <textarea formControlName="text" rows="6" class="bo-input" placeholder="Testo del nodo..."></textarea>
        </div>
        <div class="field">
          <div class="field-label">Anteprima</div>
          <div class="markdown-preview">
            <markdown [data]="nodeGroup.get('text')?.value || ''" />
          </div>
        </div>
      </div>

      <!-- Login nodo -->
      <div class="sub-section">
        <h5 class="sub-label">Login nodo</h5>
        @if (availableUsernames.length > 0) {
          <select multiple formControlName="loginUsers" class="bo-select login-select">
            @for (u of availableUsernames; track u) {
              <option [value]="u">{{ u }}</option>
            }
          </select>
          <p class="field-hint">Tieni premuto Ctrl/Cmd per selezionare più utenti.</p>
        } @else {
          <p class="empty-hint">Nessun utente fittizio dichiarato. Aggiungili nella sezione "Utenti fittizi" per abilitare il gate di login.</p>
        }
      </div>

      <!-- on_enter mutations -->
      <div class="sub-section">
        <h5 class="sub-label">on_enter</h5>
        <app-mutation-editor [rows]="onEnterArray" [availableKeys]="availableKeys" />
      </div>

      <!-- Choices -->
      <div class="sub-section">
        <h5 class="sub-label">Scelte</h5>
        @for (choice of choicesArray.controls; track choice; let ci = $index) {
          <div [formGroup]="asGroup(choice)" class="choice-row bo-card-inner">
            <div class="row-header">
              <strong>Scelta {{ ci + 1 }}</strong>
              <button type="button" class="bo-btn ghost sm danger" (click)="removeChoice(ci)">✕ Rimuovi</button>
            </div>
            <div class="field">
              <div class="field-label">Etichetta *</div>
              <input formControlName="label" class="bo-input sm" placeholder="es. Entra" />
              @if (asGroup(choice).get('label')?.invalid && asGroup(choice).get('label')?.touched) {
                <span class="field-error">L'etichetta è obbligatoria</span>
              }
            </div>
            <div class="field">
              <div class="field-label">Destinazione (id nodo)</div>
              <input formControlName="target" class="bo-input sm" placeholder="es. bunker_aperto" />
            </div>
            <div class="field">
              <div class="checkbox-row">
                <input type="checkbox" [id]="'choice-when-' + ci" formControlName="hasWhen" />
                <label [for]="'choice-when-' + ci">Condizione (when)</label>
              </div>
              @if (asGroup(choice).get('hasWhen')?.value) {
                <app-condition-builder
                  [group]="asGroup(asGroup(choice).get('when'))"
                  [canRemove]="false"
                  [availableKeys]="availableKeys"
                  (convert)="replaceChoiceWhen(ci, $event)"
                />
              }
            </div>
            <div class="field">
              <div class="checkbox-row">
                <input type="checkbox" [id]="'choice-set-' + ci" formControlName="hasSet" />
                <label [for]="'choice-set-' + ci">Mutazioni (set)</label>
              </div>
              @if (asGroup(choice).get('hasSet')?.value) {
                <app-mutation-editor [rows]="asArray(asGroup(choice).get('set'))" [availableKeys]="availableKeys" />
              }
            </div>
          </div>
        }
        <button type="button" class="bo-btn ghost sm" (click)="addChoice()">+ Aggiungi scelta</button>
      </div>

      <!-- Variants -->
      <div class="sub-section">
        <h5 class="sub-label">Varianti</h5>
        @if (variantsArray.errors?.['multipleDefaults']) {
          <span class="field-error">Al massimo una variante può essere quella predefinita</span>
        }
        @for (variant of variantsArray.controls; track variant; let vi = $index) {
          <div [formGroup]="asGroup(variant)" class="variant-row bo-card-inner">
            <div class="row-header">
              <strong>Variante {{ vi + 1 }}</strong>
              <button type="button" class="bo-btn ghost sm danger" (click)="removeVariant(vi)">✕ Rimuovi</button>
            </div>
            <div class="field">
              <div class="checkbox-row">
                <input type="checkbox" [id]="'variant-default-' + vi" formControlName="isDefault" />
                <label [for]="'variant-default-' + vi">Variante predefinita (fallback)</label>
              </div>
            </div>
            @if (!asGroup(variant).get('isDefault')?.value) {
              <div class="field">
                <div class="field-label">Condizione (when)</div>
                <app-condition-builder
                  [group]="asGroup(asGroup(variant).get('when'))"
                  [canRemove]="false"
                  [availableKeys]="availableKeys"
                  (convert)="replaceVariantWhen(vi, $event)"
                />
              </div>
            }
            <div class="field">
              <div class="field-label">Testo alternativo</div>
              <textarea formControlName="text" rows="3" class="bo-input sm" placeholder="Testo alternativo..."></textarea>
            </div>
          </div>
        }
        <button type="button" class="bo-btn ghost sm" (click)="addVariant()">+ Aggiungi variante</button>
      </div>

      <!-- Components (input) -->
      <div class="sub-section">
        <h5 class="sub-label">Componenti</h5>
        @for (comp of componentsArray.controls; track comp; let ki = $index) {
          <div [formGroup]="asGroup(comp)" class="comp-row bo-card-inner">
            <div class="row-header">
              <strong>Input {{ ki + 1 }}</strong>
              <button type="button" class="bo-btn ghost sm danger" (click)="removeComponent(ki)">✕ Rimuovi</button>
            </div>
            <div class="field">
              <div class="field-label">Placeholder</div>
              <input formControlName="placeholder" class="bo-input sm" placeholder="es. Inserisci codice" />
            </div>
            <div class="field">
              <div class="field-label">Variabile target (set)</div>
              <input formControlName="set" class="bo-input sm" placeholder="es. local.codice" />
            </div>
            <div class="field">
              <div class="field-label">Rami (branches)</div>
              @if (branchesOf(asGroup(comp)).errors?.['multipleDefaults']) {
                <span class="field-error">Al massimo un ramo può essere quello predefinito</span>
              }
              @for (branch of branchesOf(asGroup(comp)).controls; track branch; let bi = $index) {
                <div [formGroup]="asGroup(branch)" class="branch-row">
                  <div class="checkbox-row">
                    <input type="checkbox" [id]="'branch-default-' + ki + '-' + bi" formControlName="isDefault" />
                    <label [for]="'branch-default-' + ki + '-' + bi">Ramo predefinito</label>
                  </div>
                  @if (!asGroup(branch).get('isDefault')?.value) {
                    <app-condition-builder
                      [group]="asGroup(asGroup(branch).get('when'))"
                      [canRemove]="false"
                      [availableKeys]="availableKeys"
                      (convert)="replaceBranchWhen(asGroup(comp), bi, $event)"
                    />
                  }
                  <input formControlName="target" class="bo-input sm" placeholder="nodo destinazione" />
                  <button type="button" class="bo-btn ghost sm danger" (click)="removeBranch(asGroup(comp), bi)">✕</button>
                </div>
              }
              <button type="button" class="bo-btn ghost sm" (click)="addBranch(asGroup(comp))">+ Aggiungi ramo</button>
            </div>
          </div>
        }
        <button type="button" class="bo-btn ghost sm" (click)="addComponent()">+ Aggiungi componente input</button>
      </div>
    </div>
  `,
  styles: [`
    .node-editor { padding: 12px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .markdown-preview { border: 1px solid var(--bo-border, #ddd); border-radius: 6px; padding: 8px; min-height: 140px; font-size: 14px; overflow: auto; }
    .sub-section { margin-bottom: 16px; }
    .sub-label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--bo-text-faint); margin: 0 0 8px; }
    .bo-card-inner { border: 1px solid var(--bo-border, #ddd); border-radius: 6px; padding: 12px; margin-bottom: 8px; }
    .row-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .branch-row { display: flex; gap: 6px; align-items: flex-start; flex-direction: column; padding: 8px; border: 1px dashed var(--bo-border, #ddd); border-radius: 4px; margin-bottom: 6px; }
    .field { margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px; }
    .field-label { font-size: 13px; font-weight: 500; }
    .checkbox-row { display: flex; align-items: center; gap: 6px; }
    .field-error { font-size: 12px; color: var(--bo-danger, #c0392b); }
    .bo-input.sm { padding: 4px 8px; font-size: 13px; }
    .bo-btn.sm { padding: 4px 10px; font-size: 13px; }
    .danger { color: var(--bo-danger, #c0392b); }
    .empty-hint { font-size: 12px; color: var(--bo-text-faint, #999); margin: 0 0 4px; }
    .field-hint { font-size: 12px; color: var(--bo-text-faint, #999); margin: 4px 0 0; }
    .login-select { min-height: 80px; }
  `],
})
export class NodeEditorComponent {
  @Input({ required: true }) nodeGroup!: FormGroup;
  @Input() availableUsernames: string[] = [];
  @Input() availableKeys: string[] = [];

  get onEnterArray(): FormArray<FormGroup> {
    return this.nodeGroup.get('on_enter') as FormArray<FormGroup>;
  }

  get choicesArray(): FormArray<FormGroup> {
    return this.nodeGroup.get('choices') as FormArray<FormGroup>;
  }

  get variantsArray(): FormArray<FormGroup> {
    return this.nodeGroup.get('variants') as FormArray<FormGroup>;
  }

  get componentsArray(): FormArray<FormGroup> {
    return this.nodeGroup.get('components') as FormArray<FormGroup>;
  }

  addChoice(): void {
    this.choicesArray.push(makeChoiceGroup());
  }

  removeChoice(i: number): void {
    this.choicesArray.removeAt(i);
  }

  addVariant(): void {
    this.variantsArray.push(makeVariantGroup());
  }

  removeVariant(i: number): void {
    this.variantsArray.removeAt(i);
  }

  addComponent(): void {
    const g = makeComponentGroup();
    const branches = g.get('branches') as FormArray;
    branches.setValidators([atMostOneDefaultValidator('isDefault')]);
    this.componentsArray.push(g);
  }

  removeComponent(i: number): void {
    this.componentsArray.removeAt(i);
  }

  branchesOf(comp: FormGroup): FormArray<FormGroup> {
    return comp.get('branches') as FormArray<FormGroup>;
  }

  addBranch(comp: FormGroup): void {
    this.branchesOf(comp).push(makeBranchGroup());
  }

  removeBranch(comp: FormGroup, i: number): void {
    this.branchesOf(comp).removeAt(i);
  }

  replaceChoiceWhen(ci: number, g: FormGroup): void {
    (this.choicesArray.at(ci) as FormGroup).setControl('when', g);
  }

  replaceVariantWhen(vi: number, g: FormGroup): void {
    (this.variantsArray.at(vi) as FormGroup).setControl('when', g);
  }

  replaceBranchWhen(comp: FormGroup, bi: number, g: FormGroup): void {
    (this.branchesOf(comp).at(bi) as FormGroup).setControl('when', g);
  }

  asGroup(c: unknown): FormGroup {
    return c as FormGroup;
  }

  asArray(c: unknown): FormArray<FormGroup> {
    return c as FormArray<FormGroup>;
  }

  asControl(c: unknown): FormControl {
    return c as FormControl;
  }
}
