import { Injectable, inject, signal } from '@angular/core';
import { take } from 'rxjs';
import { CampaignsApiService } from './campaigns-api.service';
import type { CampaignDto } from './campaign.types';

const STORAGE_KEY = 'magnus.currentCampaignId';

@Injectable({ providedIn: 'root' })
export class CurrentCampaignService {
  private readonly api = inject(CampaignsApiService);
  readonly currentCampaign = signal<CampaignDto | null>(null);

  constructor() {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (!storedId) return;
    this.api
      .list()
      .pipe(take(1))
      .subscribe({
        next: (campaigns) => {
          const found = campaigns.find((c) => c.id === storedId);
          if (found) {
            this.setCurrent(found);
          } else {
            this.clear();
          }
        },
        error: () => {
          // transient error: keep the stored id and let the next bootstrap retry
        },
      });
  }

  setCurrent(campaign: CampaignDto): void {
    this.currentCampaign.set(campaign);
    localStorage.setItem(STORAGE_KEY, campaign.id);
  }

  clear(): void {
    this.currentCampaign.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }
}
