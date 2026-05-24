import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { GlobalSchemaDto, GlobalVarDecl } from './state.types';

@Injectable({ providedIn: 'root' })
export class CampaignGlobalSchemaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getSchema(campaignId: string): Observable<GlobalSchemaDto> {
    return this.http.get<GlobalSchemaDto>(`${this.base}/campaigns/${campaignId}/global-schema`);
  }

  addVar(campaignId: string, name: string, decl: GlobalVarDecl): Observable<void> {
    return this.http.post<void>(`${this.base}/campaigns/${campaignId}/global-schema`, { name, ...decl });
  }

  updateVar(campaignId: string, name: string, decl: Partial<GlobalVarDecl>): Observable<void> {
    return this.http.patch<void>(`${this.base}/campaigns/${campaignId}/global-schema/${name}`, decl);
  }

  deleteVar(campaignId: string, name: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/campaigns/${campaignId}/global-schema/${name}`);
  }
}
