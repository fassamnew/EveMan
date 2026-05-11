export const WEBHOOK_EVENT_TYPES = [
  'REGISTRATION_SUBMITTED',
  'REGISTRATION_CONFIRMED',
  'REGISTRATION_PENDING',
  'REGISTRATION_REJECTED'
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export type WebhookConfigRecord = {
  id: string;
  targetUrl: string;
  events: WebhookEventType[];
  isActive: boolean;
  secret?: string;
  createdAt: string;
  updatedAt: string;
};

export function webhookKeyPrefix(orgId: string): string {
  return `org:${orgId}:webhook:`;
}

export function encodeWebhookConfig(input: {
  targetUrl: string;
  events: WebhookEventType[];
  isActive: boolean;
  secret?: string;
}): string {
  const params = new URLSearchParams();
  params.set('u', input.targetUrl);
  params.set('e', input.events.join(','));
  params.set('a', input.isActive ? '1' : '0');
  if (input.secret) {
    params.set('s', input.secret);
  }
  return params.toString();
}

export function decodeWebhookConfig(value: string): {
  targetUrl: string;
  events: WebhookEventType[];
  isActive: boolean;
  secret?: string;
} | null {
  const params = new URLSearchParams(value);
  const targetUrl = params.get('u') || '';
  const eventsRaw = (params.get('e') || '').split(',').map(item => item.trim()).filter(Boolean);
  const eventSet = new Set<WebhookEventType>(WEBHOOK_EVENT_TYPES);
  const events = eventsRaw.filter((item): item is WebhookEventType => eventSet.has(item as WebhookEventType));

  if (!targetUrl || events.length === 0) {
    return null;
  }

  return {
    targetUrl,
    events,
    isActive: (params.get('a') || '1') === '1',
    secret: params.get('s') || undefined
  };
}
