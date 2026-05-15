export const COMMUNICATION_MESSAGE_TYPES = [
  'REGISTRATION_CONFIRMATION',
  'BADGE_DELIVERY',
  'APPROVAL_CONFIRMATION',
  'REJECTION_MESSAGE',
  'REMINDER',
  'EVENT_UPDATE',
  'VIP_INSTRUCTION',
  'SPEAKER_INSTRUCTION',
  'MEDIA_ACCREDITATION_NOTICE',
  'THANK_YOU_MESSAGE'
] as const;

export type CommunicationMessageType = (typeof COMMUNICATION_MESSAGE_TYPES)[number];

export const TEMPLATE_TYPE_KEY_PREFIX = 'comm-template-type:';

export function getTemplateTypeKey(templateId: string): string {
  return `${TEMPLATE_TYPE_KEY_PREFIX}${templateId}`;
}
