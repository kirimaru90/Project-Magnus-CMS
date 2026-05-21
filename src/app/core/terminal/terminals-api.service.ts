import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { TerminalContent } from '../../domain/terminal-schema';
import type { TerminalDto } from './terminal.types';

@Injectable({ providedIn: 'root' })
export class TerminalsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  listByCampaign(campaignId: string): Observable<TerminalDto[]> {
    return this.http.get<TerminalDto[]>(`${this.base}/campaigns/${campaignId}/terminals`);
  }

  create(campaignId: string, content: TerminalContent): Observable<TerminalDto> {
    return this.http.post<TerminalDto>(`${this.base}/campaigns/${campaignId}/terminals`, content);
  }

  import(campaignId: string, content: TerminalContent): Observable<TerminalDto> {
    return this.http.post<TerminalDto>(
      `${this.base}/campaigns/${campaignId}/terminals/import`,
      content,
    );
  }

  get(id: string): Observable<TerminalContent> {
    return this.http.get<TerminalContent>(`${this.base}/terminals/${id}`);
  }

  /**
   * Resolve a terminal by its user-authored `hiddenId` within a campaign. This is the
   * only API call keyed on `hiddenId`; every other terminal call uses the server-owned `id`.
   */
  getByHiddenId(campaignId: string, hiddenId: string): Observable<TerminalDto> {
    return this.http.get<TerminalDto>(
      `${this.base}/campaigns/${campaignId}/terminals/by-hidden-id/${hiddenId}`,
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/terminals/${id}`);
  }

  update(id: string, content: TerminalContent): Observable<TerminalContent> {
    return this.http.put<TerminalContent>(`${this.base}/terminals/${id}`, content);
  }

  export(id: string): Observable<TerminalContent> {
    return this.http.post<TerminalContent>(`${this.base}/terminals/${id}/export`, null);
  }
}
