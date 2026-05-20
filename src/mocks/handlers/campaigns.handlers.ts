import { http, HttpResponse } from 'msw';
import { environment } from '../../environments/environment';
import type { CampaignDto } from '../../app/core/campaign/campaign.types';
import { getUserById } from './users.handlers';

const base = environment.apiBaseUrl;

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const campaigns: CampaignDto[] = [
  { id: 'campaign-alpha', name: 'Campagna Alpha', isActive: true, isPublic: true },
  { id: 'campaign-beta', name: 'Campagna Beta', isActive: false, isPublic: false },
];

// campaignId -> Set of playerIds
const campaignPlayers = new Map<string, Set<string>>([
  ['campaign-alpha', new Set(['user-p1'])],
]);

export function removeUserFromAllCampaigns(playerId: string): void {
  for (const players of campaignPlayers.values()) {
    players.delete(playerId);
  }
}

export const campaignsHandlers = [
  http.get(`${base}/campaigns`, () => {
    return HttpResponse.json(campaigns);
  }),

  http.post(`${base}/campaigns`, async ({ request }) => {
    const body = (await request.json().catch(() => null)) as Partial<CampaignDto> | null;
    const campaign: CampaignDto = {
      id: uuid(),
      name: body?.name ?? '',
      isActive: body?.isActive ?? false,
      isPublic: body?.isPublic ?? false,
    };
    campaigns.push(campaign);
    campaignPlayers.set(campaign.id, new Set());
    return HttpResponse.json(campaign, { status: 201 });
  }),

  http.get(`${base}/campaigns/:id`, ({ params }) => {
    const found = campaigns.find((c) => c.id === params['id']);
    if (!found) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json(found);
  }),

  http.put(`${base}/campaigns/:id`, async ({ params, request }) => {
    const idx = campaigns.findIndex((c) => c.id === params['id']);
    if (idx === -1) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const body = (await request.json().catch(() => null)) as Partial<CampaignDto> | null;
    campaigns[idx] = {
      ...campaigns[idx],
      name: body?.name ?? campaigns[idx].name,
      isPublic: body?.isPublic ?? campaigns[idx].isPublic,
    };
    return HttpResponse.json(campaigns[idx]);
  }),

  http.delete(`${base}/campaigns/:id`, ({ params }) => {
    const idx = campaigns.findIndex((c) => c.id === params['id']);
    if (idx === -1) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    campaigns.splice(idx, 1);
    campaignPlayers.delete(params['id'] as string);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${base}/campaigns/:id/activate`, ({ params }) => {
    const idx = campaigns.findIndex((c) => c.id === params['id']);
    if (idx === -1) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    campaigns[idx] = { ...campaigns[idx], isActive: !campaigns[idx].isActive };
    return HttpResponse.json(campaigns[idx]);
  }),

  http.get(`${base}/campaigns/:id/players`, ({ params }) => {
    const campaignId = params['id'] as string;
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const playerIds = campaignPlayers.get(campaignId) ?? new Set<string>();
    const result = Array.from(playerIds)
      .map((pid) => getUserById(pid))
      .filter((u): u is NonNullable<typeof u> => u !== undefined)
      .map((u) => ({ id: u.id, username: u.username, role: u.role }));
    return HttpResponse.json(result);
  }),

  http.post(`${base}/campaigns/:id/players`, async ({ params, request }) => {
    const campaignId = params['id'] as string;
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) {
      return HttpResponse.json({ message: 'Campaign not found' }, { status: 404 });
    }
    const body = (await request.json().catch(() => null)) as { playerId?: string } | null;
    const playerId = body?.playerId;
    if (!playerId) {
      return HttpResponse.json({ message: 'playerId is required' }, { status: 400 });
    }
    const user = getUserById(playerId);
    if (!user) {
      return HttpResponse.json({ message: 'Player not found' }, { status: 404 });
    }
    if (user.role !== 'player') {
      return HttpResponse.json({ message: 'Only players can be assigned to campaigns' }, { status: 400 });
    }
    if (!campaignPlayers.has(campaignId)) {
      campaignPlayers.set(campaignId, new Set());
    }
    campaignPlayers.get(campaignId)!.add(playerId);
    return HttpResponse.json({ id: user.id, username: user.username, role: user.role }, { status: 201 });
  }),

  http.delete(`${base}/campaigns/:id/players/:playerId`, ({ params }) => {
    const campaignId = params['id'] as string;
    const playerId = params['playerId'] as string;
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) {
      return HttpResponse.json({ message: 'Campaign not found' }, { status: 404 });
    }
    const players = campaignPlayers.get(campaignId);
    if (!players || !players.has(playerId)) {
      return HttpResponse.json({ message: 'Assignment not found' }, { status: 404 });
    }
    players.delete(playerId);
    return new HttpResponse(null, { status: 204 });
  }),
];
