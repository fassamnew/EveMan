type BadgeRenderAlertEvent = {
  badgeId: string;
  reason: string;
  attemptsMade: number;
  attemptsAllowed: number;
  consecutiveFailures: number;
  at: string;
};

type BadgeRenderMetricsState = {
  totalJobs: number;
  successes: number;
  failures: number;
  retries: number;
  totalDurationMs: number;
  lastDurationMs: number | null;
  consecutiveFailures: number;
  alertsSent: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  lastAlert: BadgeRenderAlertEvent | null;
};

const state: BadgeRenderMetricsState = {
  totalJobs: 0,
  successes: 0,
  failures: 0,
  retries: 0,
  totalDurationMs: 0,
  lastDurationMs: null,
  consecutiveFailures: 0,
  alertsSent: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailureReason: null,
  lastAlert: null
};

function nowIso(): string {
  return new Date().toISOString();
}

export function recordBadgeRenderStart(input: { attemptsMade: number }): void {
  state.totalJobs += 1;
  if (input.attemptsMade > 0) {
    state.retries += 1;
  }
}

export function recordBadgeRenderSuccess(input: { durationMs: number }): void {
  state.successes += 1;
  state.totalDurationMs += input.durationMs;
  state.lastDurationMs = input.durationMs;
  state.consecutiveFailures = 0;
  state.lastSuccessAt = nowIso();
}

export function recordBadgeRenderFailure(input: { durationMs: number; reason: string }): void {
  state.failures += 1;
  state.totalDurationMs += input.durationMs;
  state.lastDurationMs = input.durationMs;
  state.consecutiveFailures += 1;
  state.lastFailureAt = nowIso();
  state.lastFailureReason = input.reason;
}

export function recordBadgeRenderAlert(event: Omit<BadgeRenderAlertEvent, 'at'>): BadgeRenderAlertEvent {
  const alertEvent: BadgeRenderAlertEvent = {
    ...event,
    at: nowIso()
  };

  state.alertsSent += 1;
  state.lastAlert = alertEvent;
  return alertEvent;
}

export function getBadgeRenderMetricsSnapshot() {
  const averageDurationMs = state.totalJobs > 0 ? Math.round(state.totalDurationMs / state.totalJobs) : 0;

  return {
    ...state,
    averageDurationMs
  };
}

export function getBadgeRenderAlertThreshold(): number {
  const configured = Number(process.env.BADGE_RENDER_ALERT_FAILURE_STREAK || 3);
  if (!Number.isFinite(configured) || configured < 1) {
    return 3;
  }

  return Math.floor(configured);
}
