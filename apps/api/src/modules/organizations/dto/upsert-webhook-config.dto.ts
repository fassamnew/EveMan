import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from '../../../infra/webhooks/webhook-config';

export class UpsertWebhookConfigDto {
  @IsUrl({ require_tld: false })
  @MaxLength(120)
  targetUrl!: string;

  @IsArray()
  @IsIn(WEBHOOK_EVENT_TYPES, { each: true })
  events!: WebhookEventType[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  secret?: string;
}
