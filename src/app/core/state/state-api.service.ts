import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StateEntryArraySchema } from './state.schemas';
import type { MutationAtom, StateEntryDto } from './state.types';

@Injectable({ providedIn: 'root' })
export class StateApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getTerminalState(id: string): Observable<StateEntryDto[]> {
    return this.http
      .get<unknown>(`${this.base}/terminals/${id}/state`)
      .pipe(map((r) => StateEntryArraySchema.parse(r)));
  }

  getCampaignState(id: string): Observable<StateEntryDto[]> {
    return this.http
      .get<unknown>(`${this.base}/campaigns/${id}/state`)
      .pipe(map((r) => StateEntryArraySchema.parse(r)));
  }

  mutateTerminal(id: string, mutations: MutationAtom[]): Observable<void> {
    return this.http.post<void>(`${this.base}/terminals/${id}/state/mutate`, { mutations });
  }

  mutateCampaign(id: string, mutations: MutationAtom[]): Observable<void> {
    return this.http.post<void>(`${this.base}/campaigns/${id}/state/mutate`, { mutations });
  }

  resetTerminalVar(id: string, key: string): Observable<void> {
    return this.http.post<void>(`${this.base}/terminals/${id}/state/${key}/reset`, null);
  }

  resetCampaignVar(id: string, key: string): Observable<void> {
    return this.http.post<void>(`${this.base}/campaigns/${id}/state/${key}/reset`, null);
  }

  resetTerminalAll(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/terminals/${id}/state/reset`, null);
  }

  resetCampaignAll(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/campaigns/${id}/state/reset`, null);
  }
}
