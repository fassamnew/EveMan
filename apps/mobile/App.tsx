import { StatusBar } from 'expo-status-bar';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as BackgroundFetch from 'expo-background-fetch';
import * as ExpoCrypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import CryptoJS from 'crypto-js';
import { useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

type Session = {
  accessToken: string;
  refreshToken: string;
  organizationId: string | null;
  organizationCode: string | null;
  email: string;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    email: string;
    organizationId: string | null;
    organizationCode: string | null;
  };
};

type AssignmentEvent = {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
};

type AssignmentsResponse = {
  organizationId: string;
  events: AssignmentEvent[];
};

type CheckinResult = {
  status: 'ACCEPTED' | 'DUPLICATE' | 'IDEMPOTENT_REPLAY' | 'INVALID';
  reason?: string;
  checkinId?: string;
  eventId?: string;
  registrantId?: string;
  registrant?: {
    id: string;
    name: string;
  };
  event?: {
    id: string;
    name: string;
  };
};

type PendingCheckin = {
  id: string;
  token: string;
  idempotencyKey: string;
  deviceId: string;
  source: 'MOBILE_OFFLINE';
  scannedAt: string;
  attempts: number;
  nextRetryAt: string | null;
  lastError: string | null;
};

type EncryptedQueuePayload = {
  version: 1;
  ivHex: string;
  cipherText: string;
};

type ScanHistoryEntry = {
  id: string;
  status: CheckinResult['status'] | 'QUEUED_OFFLINE';
  message: string;
  scannedAt: string;
  syncedAt: string | null;
};

type HistoryFilter = 'ALL' | 'QUEUED' | 'SYNCED' | 'FAILED';
type AppScreen = 'HOME' | 'HISTORY' | 'TELEMETRY';

type TelemetryEntry = {
  id: string;
  level: 'INFO' | 'ERROR' | 'FATAL';
  event: string;
  message: string;
  occurredAt: string;
};

type SyncHealth = {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastResult: 'IDLE' | 'NO_DATA' | 'SUCCESS' | 'FAILED';
  lastSyncedCount: number;
  lastDeferredCount: number;
  lastDroppedCount: number;
  lastRemainingCount: number;
  source: 'FOREGROUND' | 'BACKGROUND' | null;
};

const SESSION_KEY = 'evemange.mobile.session';
const OFFLINE_QUEUE_KEY = 'evemange.mobile.pending-checkins';
const OFFLINE_QUEUE_ENCRYPTION_KEY = 'evemange.mobile.pending-checkins.encryption-key';
const SCAN_HISTORY_KEY = 'evemange.mobile.scan-history';
const TELEMETRY_KEY = 'evemange.mobile.telemetry';
const SYNC_HEALTH_KEY = 'evemange.mobile.sync-health';
const EXPO_ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  ?.env;
const API_BASE = EXPO_ENV?.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5001';
const TELEMETRY_ENDPOINT = EXPO_ENV?.EXPO_PUBLIC_TELEMETRY_URL || '';
const OFFLINE_SYNC_MAX_RETRIES = 5;
const OFFLINE_SYNC_BASE_BACKOFF_MS = 5_000;
const OFFLINE_SYNC_MAX_BACKOFF_MS = 5 * 60_000;
const OFFLINE_SYNC_INTERVAL_MS = 30_000;
const OFFLINE_SYNC_BACKGROUND_INTERVAL_SECONDS = 15 * 60;
const OFFLINE_SYNC_BACKGROUND_TASK = 'evemange.offline-sync.background';

function defaultSyncHealth(): SyncHealth {
  return {
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastResult: 'IDLE',
    lastSyncedCount: 0,
    lastDeferredCount: 0,
    lastDroppedCount: 0,
    lastRemainingCount: 0,
    source: null
  };
}

async function readSyncHealth(): Promise<SyncHealth> {
  const raw = await SecureStore.getItemAsync(SYNC_HEALTH_KEY);
  if (!raw) {
    return defaultSyncHealth();
  }

  try {
    return JSON.parse(raw) as SyncHealth;
  } catch {
    await SecureStore.deleteItemAsync(SYNC_HEALTH_KEY);
    return defaultSyncHealth();
  }
}

async function writeSyncHealth(next: SyncHealth): Promise<void> {
  await SecureStore.setItemAsync(SYNC_HEALTH_KEY, JSON.stringify(next));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function computeBackoffMs(nextAttempt: number): number {
  return Math.min(
    OFFLINE_SYNC_BASE_BACKOFF_MS * 2 ** Math.max(0, nextAttempt - 1),
    OFFLINE_SYNC_MAX_BACKOFF_MS
  );
}

function markForRetry(item: PendingCheckin, reason: string): PendingCheckin {
  const nextAttempt = item.attempts + 1;
  const retryAt = new Date(Date.now() + computeBackoffMs(nextAttempt));

  return {
    ...item,
    attempts: nextAttempt,
    lastError: reason,
    nextRetryAt: retryAt.toISOString()
  };
}

async function getOrCreateOfflineQueueEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(OFFLINE_QUEUE_ENCRYPTION_KEY);
  if (existing) {
    return existing;
  }

  const randomBytes = await ExpoCrypto.getRandomBytesAsync(32);
  const keyHex = bytesToHex(randomBytes);
  await SecureStore.setItemAsync(OFFLINE_QUEUE_ENCRYPTION_KEY, keyHex);
  return keyHex;
}

async function encryptOfflineQueuePayload(raw: string): Promise<EncryptedQueuePayload> {
  const keyHex = await getOrCreateOfflineQueueEncryptionKey();
  const ivBytes = await ExpoCrypto.getRandomBytesAsync(16);
  const ivHex = bytesToHex(ivBytes);

  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const encrypted = CryptoJS.AES.encrypt(raw, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  return {
    version: 1,
    ivHex,
    cipherText: encrypted.toString()
  };
}

async function decryptOfflineQueuePayload(payload: EncryptedQueuePayload): Promise<string> {
  const keyHex = await getOrCreateOfflineQueueEncryptionKey();
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(payload.ivHex);
  const decrypted = CryptoJS.AES.decrypt(payload.cipherText, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
}

async function readPendingQueueFromStore(): Promise<PendingCheckin[]> {
  const raw = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as PendingCheckin[] | EncryptedQueuePayload;
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && parsed.version === 1) {
    const decrypted = await decryptOfflineQueuePayload(parsed);
    return JSON.parse(decrypted) as PendingCheckin[];
  }

  return [];
}

async function writePendingQueueToStore(queue: PendingCheckin[]): Promise<void> {
  const encrypted = await encryptOfflineQueuePayload(JSON.stringify(queue));
  await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(encrypted));
}

async function backgroundRefreshSession(current: Session): Promise<Session | null> {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      refreshToken: current.refreshToken
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { accessToken: string; refreshToken: string };
  const next = {
    ...current,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken
  };

  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
  return next;
}

async function backgroundAuthenticatedFetch(
  path: string,
  init: RequestInit,
  sessionRef: { current: Session | null }
): Promise<Response | null> {
  const current = sessionRef.current;
  if (!current) {
    return null;
  }

  const primary = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${current.accessToken}`
    }
  });

  if (primary.status !== 401) {
    return primary;
  }

  const refreshed = await backgroundRefreshSession(current);
  if (!refreshed) {
    return primary;
  }

  sessionRef.current = refreshed;
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${refreshed.accessToken}`
    }
  });
}

async function runBackgroundQueueSyncOnce(): Promise<BackgroundFetch.BackgroundFetchResult> {
  const sessionRaw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!sessionRaw) {
    await writeSyncHealth({
      ...defaultSyncHealth(),
      lastAttemptAt: new Date().toISOString(),
      lastResult: 'NO_DATA',
      source: 'BACKGROUND'
    });
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }

  const session = JSON.parse(sessionRaw) as Session;
  const sessionRef = { current: session };
  const queue = await readPendingQueueFromStore();
  if (queue.length === 0) {
    await writeSyncHealth({
      ...defaultSyncHealth(),
      lastAttemptAt: new Date().toISOString(),
      lastResult: 'NO_DATA',
      source: 'BACKGROUND'
    });
    return BackgroundFetch.BackgroundFetchResult.NoData;
  }

  const remaining: PendingCheckin[] = [];
  let syncedCount = 0;
  let deferredCount = 0;
  let droppedCount = 0;
  let changed = false;
  const now = Date.now();

  for (const item of queue) {
    if (item.nextRetryAt && new Date(item.nextRetryAt).getTime() > now) {
      deferredCount += 1;
      remaining.push(item);
      continue;
    }

    try {
      const response = await backgroundAuthenticatedFetch(
        '/usher/checkins',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            token: item.token,
            idempotencyKey: item.idempotencyKey,
            deviceId: item.deviceId,
            source: item.source,
            scannedAt: item.scannedAt
          })
        },
        sessionRef
      );

      if (!response) {
        remaining.push(markForRetry(item, 'NO_SESSION'));
        changed = true;
        break;
      }

      if (response.status === 400 || response.ok) {
        syncedCount += 1;
        changed = true;
        continue;
      }

      const failed = markForRetry(item, 'SERVER_ERROR');
      if (failed.attempts < OFFLINE_SYNC_MAX_RETRIES) {
        remaining.push(failed);
      } else {
        droppedCount += 1;
      }
      changed = true;
    } catch {
      const failed = markForRetry(item, 'NETWORK_ERROR');
      if (failed.attempts < OFFLINE_SYNC_MAX_RETRIES) {
        remaining.push(failed);
      } else {
        droppedCount += 1;
      }
      changed = true;
    }
  }

  const nowIso = new Date().toISOString();
  await writeSyncHealth({
    lastAttemptAt: nowIso,
    lastSuccessAt: syncedCount > 0 ? nowIso : null,
    lastResult: changed ? 'SUCCESS' : 'NO_DATA',
    lastSyncedCount: syncedCount,
    lastDeferredCount: deferredCount,
    lastDroppedCount: droppedCount,
    lastRemainingCount: remaining.length,
    source: 'BACKGROUND'
  });

  if (changed) {
    await writePendingQueueToStore(remaining);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  }

  return BackgroundFetch.BackgroundFetchResult.NoData;
}

if (!TaskManager.isTaskDefined(OFFLINE_SYNC_BACKGROUND_TASK)) {
  TaskManager.defineTask(OFFLINE_SYNC_BACKGROUND_TASK, async () => {
    try {
      return await runBackgroundQueueSyncOnce();
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export default function App() {
  const [organizationCode, setOrganizationCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<AssignmentEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [lastCheckin, setLastCheckin] = useState<CheckinResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [queuedCheckinCount, setQueuedCheckinCount] = useState(0);
  const [deferredCheckinCount, setDeferredCheckinCount] = useState(0);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL');
  const [screen, setScreen] = useState<AppScreen>('HOME');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [telemetryCount, setTelemetryCount] = useState(0);
  const [lastTelemetryMessage, setLastTelemetryMessage] = useState<string | null>(null);
  const [syncHealth, setSyncHealth] = useState<SyncHealth>(defaultSyncHealth());
  const [isSendingTelemetry, setIsSendingTelemetry] = useState(false);
  const [telemetrySendMessage, setTelemetrySendMessage] = useState<string | null>(null);
  const lastScanAtRef = useRef(0);
  const isSyncingQueueRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (!raw) {
        return;
      }

      try {
        const parsed = JSON.parse(raw) as Session;
        setSession(parsed);
        setEmail(parsed.email);
        setOrganizationCode(parsed.organizationCode || '');
      } catch {
        await SecureStore.deleteItemAsync(SESSION_KEY);
      }

      await refreshQueueCount();
      await refreshScanHistory();
      await refreshTelemetry();
      await refreshSyncHealth();
    })();
  }, []);

  useEffect(() => {
    const errorUtils = (
      globalThis as {
        ErrorUtils?: {
          getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
          setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
        };
      }
    ).ErrorUtils;

    if (!errorUtils?.setGlobalHandler) {
      return;
    }

    const previousHandler = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      void appendTelemetry({
        level: isFatal ? 'FATAL' : 'ERROR',
        event: 'APP_UNHANDLED_ERROR',
        message: `${error.name}: ${error.message}`
      });

      if (previousHandler) {
        previousHandler(error, isFatal);
      }
    });
  }, []);

  useEffect(() => {
    if (!session) {
      setEvents([]);
      setSelectedEventId(null);
      return;
    }

    void loadAssignments();
    void syncPendingQueue();
  }, [session?.accessToken]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const intervalId = setInterval(() => {
      void syncPendingQueue();
    }, OFFLINE_SYNC_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [session?.accessToken]);

  useEffect(() => {
    void (async () => {
      if (!session) {
        const registered = await TaskManager.isTaskRegisteredAsync(OFFLINE_SYNC_BACKGROUND_TASK);
        if (registered) {
          await BackgroundFetch.unregisterTaskAsync(OFFLINE_SYNC_BACKGROUND_TASK);
        }
        return;
      }

      const status = await BackgroundFetch.getStatusAsync();
      if (status !== BackgroundFetch.BackgroundFetchStatus.Available) {
        return;
      }

      const registered = await TaskManager.isTaskRegisteredAsync(OFFLINE_SYNC_BACKGROUND_TASK);
      if (!registered) {
        await BackgroundFetch.registerTaskAsync(OFFLINE_SYNC_BACKGROUND_TASK, {
          minimumInterval: OFFLINE_SYNC_BACKGROUND_INTERVAL_SECONDS,
          stopOnTerminate: false,
          startOnBoot: true
        });
      }
    })();
  }, [session?.accessToken]);

  async function persistSession(nextSession: Session): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  async function attemptRefresh(current: Session): Promise<Session | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          refreshToken: current.refreshToken
        })
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as { accessToken: string; refreshToken: string };
      const next = {
        ...current,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken
      };

      await persistSession(next);
      return next;
    } catch {
      return null;
    }
  }

  async function getPendingQueue(): Promise<PendingCheckin[]> {
    const raw = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as PendingCheckin[] | EncryptedQueuePayload;
      if (Array.isArray(parsed)) {
        return parsed;
      }

      if (parsed && parsed.version === 1) {
        const decrypted = await decryptOfflineQueuePayload(parsed);
        const queue = JSON.parse(decrypted) as PendingCheckin[];
        return queue;
      }

      return [];
    } catch {
      await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
      return [];
    }
  }


  async function getScanHistory(): Promise<ScanHistoryEntry[]> {
    const raw = await SecureStore.getItemAsync(SCAN_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as ScanHistoryEntry[];
    } catch {
      await SecureStore.deleteItemAsync(SCAN_HISTORY_KEY);
      return [];
    }
  }

  async function getTelemetry(): Promise<TelemetryEntry[]> {
    const raw = await SecureStore.getItemAsync(TELEMETRY_KEY);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as TelemetryEntry[];
    } catch {
      await SecureStore.deleteItemAsync(TELEMETRY_KEY);
      return [];
    }
  }

  async function saveTelemetry(entries: TelemetryEntry[]): Promise<void> {
    await SecureStore.setItemAsync(TELEMETRY_KEY, JSON.stringify(entries));
    setTelemetryCount(entries.length);
    setLastTelemetryMessage(entries[0]?.message || null);
  }

  async function refreshTelemetry(): Promise<void> {
    const entries = await getTelemetry();
    setTelemetryCount(entries.length);
    setLastTelemetryMessage(entries[0]?.message || null);
  }

  async function appendTelemetry(entry: {
    level: TelemetryEntry['level'];
    event: string;
    message: string;
  }): Promise<void> {
    const nextEntry: TelemetryEntry = {
      id: createIdempotencyKey(),
      level: entry.level,
      event: entry.event,
      message: entry.message,
      occurredAt: new Date().toISOString()
    };

    const history = await getTelemetry();
    const next = [nextEntry, ...history].slice(0, 50);
    await saveTelemetry(next);
  }

  async function clearTelemetry(): Promise<void> {
    await SecureStore.deleteItemAsync(TELEMETRY_KEY);
    setTelemetryCount(0);
    setLastTelemetryMessage(null);
    setTelemetrySendMessage(null);
  }

  async function refreshSyncHealth(): Promise<void> {
    const health = await readSyncHealth();
    setSyncHealth(health);
  }

  async function updateSyncHealth(next: SyncHealth): Promise<void> {
    await writeSyncHealth(next);
    setSyncHealth(next);
  }

  async function saveScanHistory(history: ScanHistoryEntry[]): Promise<void> {
    await SecureStore.setItemAsync(SCAN_HISTORY_KEY, JSON.stringify(history));
    setScanHistory(history);
  }

  async function refreshScanHistory(): Promise<void> {
    const history = await getScanHistory();
    setScanHistory(history);
  }

  async function appendScanHistory(entry: ScanHistoryEntry): Promise<void> {
    const history = await getScanHistory();
    const next = [entry, ...history].slice(0, 20);
    await saveScanHistory(next);
  }

  async function setPendingQueue(queue: PendingCheckin[]): Promise<void> {
    const encrypted = await encryptOfflineQueuePayload(JSON.stringify(queue));
    await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(encrypted));
    updateQueueSummary(queue);
  }

  async function refreshQueueCount(): Promise<void> {
    const queue = await getPendingQueue();
    updateQueueSummary(queue);
  }

  function updateQueueSummary(queue: PendingCheckin[]): void {
    const now = Date.now();
    const deferred = queue.filter(item => item.nextRetryAt && new Date(item.nextRetryAt).getTime() > now)
      .length;

    setQueuedCheckinCount(queue.length);
    setDeferredCheckinCount(deferred);
  }

  async function enqueuePendingCheckin(token: string): Promise<void> {
    const queue = await getPendingQueue();
    const nextItem: PendingCheckin = {
      id: createIdempotencyKey(),
      token,
      idempotencyKey: createIdempotencyKey(),
      deviceId: 'mobile-usher-device',
      source: 'MOBILE_OFFLINE',
      scannedAt: new Date().toISOString(),
      attempts: 0,
      nextRetryAt: null,
      lastError: null
    };

    queue.push(nextItem);
    await setPendingQueue(queue);
    setSyncMessage(`Queued ${queue.length} offline scan(s)`);
    await appendScanHistory({
      id: nextItem.id,
      status: 'QUEUED_OFFLINE',
      message: 'Scan queued for deferred sync',
      scannedAt: nextItem.scannedAt,
      syncedAt: null
    });
  }

  async function authenticatedFetch(path: string, init?: RequestInit): Promise<Response | null> {
    if (!session) {
      return null;
    }

    const primary = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${session.accessToken}`
      }
    });

    if (primary.status !== 401) {
      return primary;
    }

    const refreshed = await attemptRefresh(session);
    if (!refreshed) {
      return primary;
    }

    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${refreshed.accessToken}`
      }
    });
  }

  async function loadAssignments(): Promise<void> {
    if (!session) {
      return;
    }

    setIsLoadingAssignments(true);
    setError(null);

    try {
      const response = await authenticatedFetch('/usher/assignments');
      if (!response || !response.ok) {
        setError('Failed to load assignments');
        await appendTelemetry({
          level: 'ERROR',
          event: 'USHER_ASSIGNMENTS_FETCH_FAILED',
          message: 'Assignments endpoint returned a non-success status'
        });
        return;
      }

      const payload = (await response.json()) as AssignmentsResponse;
      setEvents(payload.events);
      setSelectedEventId(payload.events[0]?.id || null);
    } catch {
      setError('Network error while loading assignments');
      await appendTelemetry({
        level: 'ERROR',
        event: 'USHER_ASSIGNMENTS_FETCH_ERROR',
        message: 'Assignments request failed due to network/runtime error'
      });
    } finally {
      setIsLoadingAssignments(false);
    }
  }

  async function parseCheckinResponse(response: Response): Promise<CheckinResult | null> {
    if (response.status === 400) {
      const payload = (await response.json().catch(() => ({}))) as {
        message?: { status?: 'INVALID'; reason?: string };
      };
      return {
        status: 'INVALID',
        reason: payload.message?.reason || 'TOKEN_INVALID'
      };
    }

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CheckinResult;
  }

  async function syncPendingQueue(): Promise<void> {
    if (!session || isSyncingQueueRef.current) {
      return;
    }

    const queue = await getPendingQueue();
    if (queue.length === 0) {
      setSyncMessage('Offline queue is empty');
      const nowIso = new Date().toISOString();
      await updateSyncHealth({
        lastAttemptAt: nowIso,
        lastSuccessAt: syncHealth.lastSuccessAt,
        lastResult: 'NO_DATA',
        lastSyncedCount: 0,
        lastDeferredCount: 0,
        lastDroppedCount: 0,
        lastRemainingCount: 0,
        source: 'FOREGROUND'
      });
      return;
    }

    isSyncingQueueRef.current = true;
    setIsSyncingQueue(true);
    setSyncMessage(`Syncing ${queue.length} queued scan(s)...`);

    try {
      const remaining: PendingCheckin[] = [];
      let syncedCount = 0;
      let deferredCount = 0;
      let droppedCount = 0;
      const now = Date.now();

      for (const item of queue) {
        if (item.nextRetryAt && new Date(item.nextRetryAt).getTime() > now) {
          deferredCount += 1;
          remaining.push(item);
          continue;
        }

        try {
          const response = await authenticatedFetch('/usher/checkins', {
            method: 'POST',
            headers: {
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              token: item.token,
              idempotencyKey: item.idempotencyKey,
              deviceId: item.deviceId,
              source: item.source,
              scannedAt: item.scannedAt
            })
          });

          if (!response) {
            remaining.push(markForRetry(item, 'NO_SESSION'));
            break;
          }

          const result = await parseCheckinResponse(response);
          if (!result) {
            const failed = markForRetry(item, 'SERVER_ERROR');
            if (failed.attempts >= OFFLINE_SYNC_MAX_RETRIES) {
              droppedCount += 1;
              await appendScanHistory({
                id: failed.id,
                status: 'INVALID',
                message: 'Queued scan dropped after retry limit reached',
                scannedAt: failed.scannedAt,
                syncedAt: null
              });
              await appendTelemetry({
                level: 'ERROR',
                event: 'OFFLINE_SYNC_RETRY_LIMIT_REACHED',
                message: `Dropped queued scan ${failed.id} after ${failed.attempts} attempts`
              });
            } else {
              remaining.push(failed);
            }
            continue;
          }

          syncedCount += 1;
          setLastCheckin(result);
          await appendScanHistory({
            id: item.id,
            status: result.status,
            message: `Queued scan synced as ${result.status}`,
            scannedAt: item.scannedAt,
            syncedAt: new Date().toISOString()
          });
        } catch {
          const failed = markForRetry(item, 'NETWORK_ERROR');
          if (failed.attempts >= OFFLINE_SYNC_MAX_RETRIES) {
            droppedCount += 1;
            await appendScanHistory({
              id: failed.id,
              status: 'INVALID',
              message: 'Queued scan dropped after network retry limit reached',
              scannedAt: failed.scannedAt,
              syncedAt: null
            });
            await appendTelemetry({
              level: 'ERROR',
              event: 'OFFLINE_SYNC_NETWORK_RETRY_LIMIT_REACHED',
              message: `Dropped queued scan ${failed.id} after ${failed.attempts} network attempts`
            });
          } else {
            remaining.push(failed);
          }
          continue;
        }
      }

      await setPendingQueue(remaining);
      setSyncMessage(
        `Synced ${syncedCount}, deferred ${deferredCount}, dropped ${droppedCount}, remaining ${remaining.length}`
      );
      const nowIso = new Date().toISOString();
      await updateSyncHealth({
        lastAttemptAt: nowIso,
        lastSuccessAt: syncedCount > 0 ? nowIso : syncHealth.lastSuccessAt,
        lastResult: 'SUCCESS',
        lastSyncedCount: syncedCount,
        lastDeferredCount: deferredCount,
        lastDroppedCount: droppedCount,
        lastRemainingCount: remaining.length,
        source: 'FOREGROUND'
      });
    } finally {
      isSyncingQueueRef.current = false;
      setIsSyncingQueue(false);
    }
  }

  async function signIn(): Promise<void> {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          orgCode: organizationCode.trim() || undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || 'Login failed');
        await appendTelemetry({
          level: 'ERROR',
          event: 'AUTH_LOGIN_FAILED',
          message: payload.message || 'Login failed'
        });
        return;
      }

      const payload = (await response.json()) as LoginResponse;
      const nextSession: Session = {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        organizationId: payload.user.organizationId,
        organizationCode: payload.user.organizationCode,
        email: payload.user.email
      };

      await persistSession(nextSession);
      setPassword('');
      await appendTelemetry({
        level: 'INFO',
        event: 'AUTH_LOGIN_SUCCESS',
        message: `User ${payload.user.email} signed in`
      });
    } catch {
      setError('Network error while attempting login');
      await appendTelemetry({
        level: 'ERROR',
        event: 'AUTH_LOGIN_ERROR',
        message: 'Network/runtime error while attempting login'
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut(): Promise<void> {
    if (session) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: session.refreshToken })
      }).catch(() => undefined);
    }

    await SecureStore.deleteItemAsync(SESSION_KEY);
    setSession(null);
    setEvents([]);
    setSelectedEventId(null);
    setTokenInput('');
    setLastCheckin(null);
    setSyncMessage(null);
    setScreen('HOME');
    setIsScannerOpen(false);
    await appendTelemetry({
      level: 'INFO',
      event: 'AUTH_LOGOUT',
      message: 'User signed out and local session state was cleared'
    });
  }

  function createIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function submitCheckin(tokenValue?: string): Promise<void> {
    const effectiveToken = (tokenValue || tokenInput).trim();

    if (!effectiveToken) {
      setError('QR token is required');
      return;
    }

    setError(null);
    setIsSubmittingCheckin(true);

    try {
      const response = await authenticatedFetch('/usher/checkins', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          token: effectiveToken,
          idempotencyKey: createIdempotencyKey(),
          deviceId: 'mobile-usher-device',
          source: 'MOBILE_ONLINE',
          scannedAt: new Date().toISOString()
        })
      });

      if (!response) {
        setError('No active session');
        await appendTelemetry({
          level: 'ERROR',
          event: 'CHECKIN_SUBMIT_NO_SESSION',
          message: 'Check-in submission attempted without active session'
        });
        return;
      }

      const result = await parseCheckinResponse(response);
      if (!result) {
        await enqueuePendingCheckin(effectiveToken);
        await appendTelemetry({
          level: 'ERROR',
          event: 'CHECKIN_SUBMIT_QUEUED',
          message: 'Check-in request failed and was queued for offline sync'
        });
        setTokenInput('');
        return;
      }

      setLastCheckin(result);
      await appendScanHistory({
        id: createIdempotencyKey(),
        status: result.status,
        message: `Live scan result: ${result.status}`,
        scannedAt: new Date().toISOString(),
        syncedAt: new Date().toISOString()
      });
      await appendTelemetry({
        level: 'INFO',
        event: 'CHECKIN_SUBMIT_RESULT',
        message: `Live check-in completed with status ${result.status}`
      });
      setTokenInput('');
    } catch {
      await enqueuePendingCheckin(effectiveToken);
      await appendTelemetry({
        level: 'ERROR',
        event: 'CHECKIN_SUBMIT_ERROR',
        message: 'Check-in submission failed with runtime/network error and was queued'
      });
      setTokenInput('');
    } finally {
      setIsSubmittingCheckin(false);
      await refreshQueueCount();
    }
  }

  async function openScanner(): Promise<void> {
    setError(null);
    if (!cameraPermission?.granted) {
      const nextPermission = await requestCameraPermission();
      if (!nextPermission.granted) {
        setError('Camera permission is required to scan QR codes');
        await appendTelemetry({
          level: 'ERROR',
          event: 'SCANNER_PERMISSION_DENIED',
          message: 'User denied camera permission'
        });
        return;
      }
    }

    setIsScannerOpen(true);
  }

  function handleBarcodeScanned(result: BarcodeScanningResult): void {
    const now = Date.now();
    if (now - lastScanAtRef.current < 1500) {
      return;
    }

    lastScanAtRef.current = now;
    setIsScannerOpen(false);
    setTokenInput(result.data);
    void appendTelemetry({
      level: 'INFO',
      event: 'SCANNER_QR_CAPTURED',
      message: 'QR code captured from camera stream'
    });
    void submitCheckin(result.data);
  }

  function renderResult(): string {
    if (!lastCheckin) {
      return 'No scans yet.';
    }

    if (lastCheckin.status === 'ACCEPTED') {
      return `ACCEPTED: ${lastCheckin.registrant?.name || 'Registrant'} checked in.`;
    }

    if (lastCheckin.status === 'DUPLICATE') {
      return `DUPLICATE: ${lastCheckin.registrant?.name || 'Registrant'} was already checked in.`;
    }

    if (lastCheckin.status === 'IDEMPOTENT_REPLAY') {
      return 'IDEMPOTENT_REPLAY: this scan request was already processed.';
    }

    return `INVALID: ${lastCheckin.reason || 'Unknown token error'}`;
  }

  function formatTimestamp(value: string | null): string {
    if (!value) {
      return 'n/a';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString();
  }

  async function exportScanHistory(): Promise<void> {
    const payload = {
      exportedAt: new Date().toISOString(),
      filter: historyFilter,
      itemCount: filteredHistory.length,
      entries: filteredHistory
    };

    await Share.share({
      title: 'EveMange scan history export',
      message: JSON.stringify(payload, null, 2)
    });
  }

  async function exportTelemetryEntries(): Promise<void> {
    const entries = await getTelemetry();
    const payload = {
      exportedAt: new Date().toISOString(),
      itemCount: entries.length,
      entries
    };

    await Share.share({
      title: 'EveMange telemetry export',
      message: JSON.stringify(payload, null, 2)
    });
  }

  async function flushTelemetryToEndpoint(): Promise<void> {
    setTelemetrySendMessage(null);
    if (!TELEMETRY_ENDPOINT) {
      setTelemetrySendMessage('Set EXPO_PUBLIC_TELEMETRY_URL to enable external telemetry upload');
      return;
    }

    const entries = await getTelemetry();
    if (entries.length === 0) {
      setTelemetrySendMessage('No telemetry entries to send');
      return;
    }

    setIsSendingTelemetry(true);
    try {
      const response = await fetch(TELEMETRY_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          source: 'evemange-mobile',
          generatedAt: new Date().toISOString(),
          entries
        })
      });

      if (!response.ok) {
        setTelemetrySendMessage(`Telemetry upload failed (${response.status})`);
        return;
      }

      await clearTelemetry();
      setTelemetrySendMessage('Telemetry upload succeeded and local buffer was cleared');
    } catch {
      setTelemetrySendMessage('Telemetry upload failed due to network/runtime error');
    } finally {
      setIsSendingTelemetry(false);
    }
  }

  async function exportSyncDiagnostics(): Promise<void> {
    const payload = {
      exportedAt: new Date().toISOString(),
      syncHealth,
      queueSummary: {
        queuedCheckinCount,
        deferredCheckinCount
      }
    };

    await Share.share({
      title: 'EveMange sync diagnostics export',
      message: JSON.stringify(payload, null, 2)
    });
  }

  function getFilteredHistory(): ScanHistoryEntry[] {
    if (historyFilter === 'ALL') {
      return scanHistory;
    }

    if (historyFilter === 'QUEUED') {
      return scanHistory.filter(item => item.status === 'QUEUED_OFFLINE');
    }

    if (historyFilter === 'SYNCED') {
      return scanHistory.filter(
        item =>
          item.status === 'ACCEPTED' ||
          item.status === 'DUPLICATE' ||
          item.status === 'IDEMPOTENT_REPLAY'
      );
    }

    return scanHistory.filter(item => item.status === 'INVALID');
  }

  const filteredHistory = getFilteredHistory();
  const queuedHistoryCount = scanHistory.filter(item => item.status === 'QUEUED_OFFLINE').length;
  const syncedHistoryCount = scanHistory.filter(
    item =>
      item.status === 'ACCEPTED' || item.status === 'DUPLICATE' || item.status === 'IDEMPOTENT_REPLAY'
  ).length;
  const failedHistoryCount = scanHistory.filter(item => item.status === 'INVALID').length;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.title}>EveMange Usher Mobile</Text>
        <Text style={styles.subtitle}>Phase 6 mobile auth, scanner, and offline sync baseline.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {session ? (
          <View style={styles.card}>
            <View style={styles.topNavRow}>
              <Pressable
                style={[styles.navChip, screen === 'HOME' ? styles.navChipActive : null]}
                onPress={() => setScreen('HOME')}
              >
                <Text style={styles.navChipText}>Home</Text>
              </Pressable>
              <Pressable
                style={[styles.navChip, screen === 'HISTORY' ? styles.navChipActive : null]}
                onPress={() => setScreen('HISTORY')}
              >
                <Text style={styles.navChipText}>History</Text>
              </Pressable>
              <Pressable
                style={[styles.navChip, screen === 'TELEMETRY' ? styles.navChipActive : null]}
                onPress={() => setScreen('TELEMETRY')}
              >
                <Text style={styles.navChipText}>Telemetry</Text>
              </Pressable>
            </View>

            {screen === 'HISTORY' ? (
              <View style={styles.sectionStack}>
                <Text style={styles.label}>Scan History</Text>
                <View style={styles.historySummaryRow}>
                  <Text style={styles.meta}>Queued: {queuedHistoryCount}</Text>
                  <Text style={styles.meta}>Synced: {syncedHistoryCount}</Text>
                  <Text style={styles.meta}>Failed: {failedHistoryCount}</Text>
                </View>
                <View style={styles.filterRow}>
                  {(['ALL', 'QUEUED', 'SYNCED', 'FAILED'] as const).map(filter => (
                    <Pressable
                      key={filter}
                      style={[styles.filterChip, historyFilter === filter ? styles.filterChipActive : null]}
                      onPress={() => setHistoryFilter(filter)}
                    >
                      <Text style={styles.filterChipText}>{filter}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable style={styles.buttonSecondary} onPress={() => void exportScanHistory()}>
                  <Text style={styles.buttonTextInverse}>Export history JSON</Text>
                </Pressable>
                {filteredHistory.length === 0 ? (
                  <Text style={styles.meta}>No scan history yet.</Text>
                ) : (
                  <ScrollView style={styles.historyScroll} contentContainerStyle={styles.historyList}>
                    {filteredHistory.map(entry => (
                      <View key={entry.id} style={styles.historyItem}>
                        <Text style={styles.historyStatus}>{entry.status}</Text>
                        <Text style={styles.meta}>{entry.message}</Text>
                        <Text style={styles.metaSmall}>Scanned: {formatTimestamp(entry.scannedAt)}</Text>
                        <Text style={styles.metaSmall}>Synced: {formatTimestamp(entry.syncedAt)}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : null}

            {screen === 'TELEMETRY' ? (
              <View style={styles.sectionStack}>
                <Text style={styles.label}>Telemetry</Text>
                <Text style={styles.meta}>Stored events: {telemetryCount}</Text>
                <Text style={styles.meta}>Latest: {lastTelemetryMessage || 'No telemetry yet.'}</Text>
                <Pressable
                  style={styles.button}
                  onPress={() => void flushTelemetryToEndpoint()}
                  disabled={isSendingTelemetry}
                >
                  <Text style={styles.buttonText}>
                    {isSendingTelemetry ? 'Sending telemetry...' : 'Send telemetry to endpoint'}
                  </Text>
                </Pressable>
                {telemetrySendMessage ? <Text style={styles.meta}>{telemetrySendMessage}</Text> : null}
                <Pressable style={styles.buttonSecondary} onPress={() => void exportTelemetryEntries()}>
                  <Text style={styles.buttonTextInverse}>Export telemetry JSON</Text>
                </Pressable>
                <Pressable style={styles.buttonSecondary} onPress={() => void clearTelemetry()}>
                  <Text style={styles.buttonTextInverse}>Clear telemetry log</Text>
                </Pressable>
              </View>
            ) : null}

            {screen === 'HOME' ? (
              <>
            <Text style={styles.label}>Session active</Text>
            <Text style={styles.meta}>User: {session.email}</Text>
            <Text style={styles.meta}>Org: {session.organizationCode || session.organizationId || 'unscoped'}</Text>

            <Text style={styles.label}>Assigned events</Text>
            {isLoadingAssignments ? <Text style={styles.meta}>Loading assignments...</Text> : null}
            {!isLoadingAssignments && events.length === 0 ? (
              <Text style={styles.meta}>No assigned published events.</Text>
            ) : null}
            {!isLoadingAssignments && events.length > 0 ? (
              <View style={styles.eventsList}>
                {events.map(item => (
                  <Pressable
                    key={item.id}
                    style={[styles.eventChip, selectedEventId === item.id ? styles.eventChipActive : null]}
                    onPress={() => setSelectedEventId(item.id)}
                  >
                    <Text style={styles.eventChipText}>{item.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={styles.label}>Scanner verification</Text>
            <Text style={styles.meta}>Selected event: {selectedEventId || 'none'}</Text>
                <Pressable style={styles.buttonSecondary} onPress={() => void exportSyncDiagnostics()}>
                  <Text style={styles.buttonTextInverse}>Export sync diagnostics</Text>
                </Pressable>
            {isScannerOpen ? (
              <View style={styles.cameraContainer}>
                <CameraView
                  style={styles.cameraPreview}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleBarcodeScanned}
                />
                <Pressable style={styles.buttonSecondary} onPress={() => setIsScannerOpen(false)}>
                  <Text style={styles.buttonTextInverse}>Close scanner</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.button} onPress={() => void openScanner()}>
                <Text style={styles.buttonText}>Open camera scanner</Text>
              </Pressable>
            )}
            <TextInput
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="Paste QR token"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              autoCapitalize="none"
            />
            <Pressable style={styles.button} onPress={() => void submitCheckin()}>
              <Text style={styles.buttonText}>
                {isSubmittingCheckin ? 'Verifying scan...' : 'Verify check-in'}
              </Text>
            </Pressable>
            <Text style={styles.meta}>Queued offline scans: {queuedCheckinCount}</Text>
            <Text style={styles.meta}>Waiting for retry window: {deferredCheckinCount}</Text>
            <Text style={styles.meta}>Auto sync interval: 30s</Text>
            <Text style={styles.meta}>Last sync result: {syncHealth.lastResult}</Text>
            <Text style={styles.meta}>Last sync source: {syncHealth.source || 'n/a'}</Text>
            <Text style={styles.meta}>Last sync attempt: {formatTimestamp(syncHealth.lastAttemptAt)}</Text>
            <Text style={styles.meta}>Last sync success: {formatTimestamp(syncHealth.lastSuccessAt)}</Text>
            {syncMessage ? <Text style={styles.meta}>{syncMessage}</Text> : null}
            <Pressable
              style={styles.buttonSecondary}
              onPress={() => void syncPendingQueue()}
              disabled={isSyncingQueue}
            >
              <Text style={styles.buttonTextInverse}>
                {isSyncingQueue ? 'Syncing queued scans...' : 'Sync queued scans'}
              </Text>
            </Pressable>
            <Text style={styles.meta}>{renderResult()}</Text>

            <Text style={styles.label}>Recent scan history</Text>
            {filteredHistory.length === 0 ? (
              <Text style={styles.meta}>No scan history yet.</Text>
            ) : (
              <View style={styles.historyList}>
                {filteredHistory.slice(0, 8).map(entry => (
                  <View key={entry.id} style={styles.historyItem}>
                    <Text style={styles.historyStatus}>{entry.status}</Text>
                    <Text style={styles.meta}>{entry.message}</Text>
                  </View>
                ))}
              </View>
            )}
              </>
            ) : null}

            <Pressable style={styles.buttonSecondary} onPress={() => void signOut()}>
              <Text style={styles.buttonTextInverse}>Sign out</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <TextInput
              value={organizationCode}
              onChangeText={setOrganizationCode}
              placeholder="Organization ID"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              autoCapitalize="none"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              secureTextEntry
            />
            <Pressable style={styles.button} onPress={() => void signIn()}>
              <Text style={styles.buttonText}>{isSubmitting ? 'Signing in...' : 'Sign in'}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617'
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700'
  },
  subtitle: {
    color: '#cbd5e1',
    marginTop: 8,
    marginBottom: 20
  },
  error: {
    color: '#fda4af',
    marginBottom: 12
  },
  card: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10
  },
  input: {
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  button: {
    backgroundColor: '#22d3ee',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6
  },
  buttonSecondary: {
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6
  },
  buttonText: {
    color: '#020617',
    fontWeight: '700'
  },
  buttonTextInverse: {
    color: '#f8fafc',
    fontWeight: '700'
  },
  label: {
    color: '#22d3ee',
    fontWeight: '700'
  },
  meta: {
    color: '#cbd5e1'
  },
  eventsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  eventChip: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  eventChipActive: {
    borderColor: '#22d3ee',
    backgroundColor: '#0b2530'
  },
  eventChipText: {
    color: '#e2e8f0',
    fontSize: 12
  },
  cameraContainer: {
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    gap: 8,
    padding: 8
  },
  cameraPreview: {
    width: '100%',
    height: 220,
    borderRadius: 8
  },
  historyList: {
    gap: 8
  },
  topNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6
  },
  navChip: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  navChipActive: {
    borderColor: '#22d3ee',
    backgroundColor: '#0b2530'
  },
  navChipText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700'
  },
  sectionStack: {
    gap: 10
  },
  historySummaryRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  filterChipActive: {
    borderColor: '#22d3ee',
    backgroundColor: '#0b2530'
  },
  filterChipText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700'
  },
  historyItem: {
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10
  },
  historyScroll: {
    maxHeight: 340
  },
  historyStatus: {
    color: '#bae6fd',
    fontWeight: '700',
    marginBottom: 4
  },
  metaSmall: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  }
});
