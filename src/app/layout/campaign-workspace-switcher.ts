import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { CampaignsApiService } from '../core/campaign/campaigns-api.service';
import type { CampaignDto } from '../core/campaign/campaign.types';
import { CurrentCampaignService } from '../core/campaign/current-campaign.service';

@Component({
  selector: 'app-campaign-workspace-switcher',
  standalone: true,
  imports: [Select, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-select
      [options]="campaigns() ?? []"
      optionLabel="name"
      dataKey="id"
      [ngModel]="currentCampaign.currentCampaign()"
      (onChange)="onSelect($event.value)"
      placeholder="Seleziona campagna"
    />
  `,
})
export class CampaignWorkspaceSwitcherComponent {
  private readonly api = inject(CampaignsApiService);
  protected readonly currentCampaign = inject(CurrentCampaignService);
  protected readonly campaigns = toSignal(this.api.list());

  onSelect(campaign: CampaignDto): void {
    this.currentCampaign.setCurrent(campaign);
  }
}
