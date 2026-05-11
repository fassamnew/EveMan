export type CreatedOrganization = {
  id: string;
  name: string;
  code: string;
  isActive?: boolean;
  createdAt?: string;
};

export type PlatformOverview = {
  organizations: number;
  activeOrganizations: number;
  users: number;
  activeUsers: number;
  events: number;
  auditLogCount: number;
};

export type PlatformEvent = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  organization: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  };
};

export type BackupArtifacts = {
  directory: string | null;
  reports: string[];
};

export type BackupRestoreDrillTriggerResult = {
  accepted: boolean;
  action: 'backup_restore_drill';
  pid: number;
  scriptPath: string;
  startedAt: string;
};

export type SystemUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  userRoles: Array<{
    role: { name: string };
    organization: { id: string; code: string; name: string } | null;
  }>;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  outcome: 'SUCCESS' | 'FAILURE';
  createdAt: string;
  actorUser: { id: string; email: string } | null;
  organization: { id: string; code: string; name: string } | null;
};

export type JsonSettingValue = Record<string, unknown>;
