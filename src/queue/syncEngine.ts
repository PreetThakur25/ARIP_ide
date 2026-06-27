import { AuthManager } from '../authentication/authManager';
import { ExtensionConfig } from '../config/settings';
import { Logger } from '../utils/logger';
import { EncryptedLocalQueue } from './localQueue';

export class SyncEngine {
  private static instance: SyncEngine;
  private isSyncing: boolean = false;
  private syncTimer: NodeJS.Timeout | undefined;
  
  // Connection states
  private backoffMs: number = 2000;
  private readonly MAX_BACKOFF_MS = 300000; // 5 minutes
  private isOffline: boolean = false;

  private onStatusChangeCallbacks: Set<(status: string, queueSize: number) => void> = new Set();

  private constructor() {}

  public static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  public registerStatusListener(callback: (status: string, queueSize: number) => void): void {
    this.onStatusChangeCallbacks.add(callback);
    // Initial notify
    callback(this.getConnectionStatusText(), EncryptedLocalQueue.getInstance().getQueueSize());
  }

  public startSyncLoop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    const intervalSeconds = ExtensionConfig.uploadInterval;
    Logger.info(`Starting background telemetry synchronization loop (interval: ${intervalSeconds}s)`);

    this.syncTimer = setInterval(() => {
      this.triggerSync();
    }, intervalSeconds * 1000);

    // Initial sync
    setTimeout(() => this.triggerSync(), 2000);
  }

  public stopSyncLoop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
    Logger.info('Telemetry synchronization loop stopped.');
  }

  public async triggerSync(): Promise<void> {
    if (this.isSyncing) {
      return;
    }

    const queue = EncryptedLocalQueue.getInstance();
    const queueSize = queue.getQueueSize();

    if (queueSize === 0) {
      this.notifyListeners('Idle', 0);
      return;
    }

    const auth = AuthManager.getInstance();
    const token = await auth.getToken();

    if (!token) {
      Logger.debug('Sync postponed: User is not authenticated.');
      this.notifyListeners('Unauthorized', queueSize);
      return;
    }

    this.isSyncing = true;
    this.notifyListeners('Syncing...', queueSize);

    try {
      // Dequeue a batch (default batch size is 30 events)
      const batch = await queue.dequeueBatch(30);
      if (batch.length === 0) {
        this.isSyncing = false;
        this.notifyListeners('Idle', queue.getQueueSize());
        return;
      }

      Logger.debug(`Attempting to upload batch of ${batch.length} telemetry events...`);
      const success = await this.uploadBatch(batch, token);

      if (success) {
        // Purge uploaded items from queue
        const eventIds = batch.map(e => e.eventId);
        await queue.acknowledge(eventIds);
        
        // Reset backoff metrics on successful push
        this.backoffMs = 2000;
        this.isOffline = false;

        Logger.debug('Batch upload completed successfully.');
      } else {
        Logger.warn('Batch upload failed. Retrying in next sync window.');
      }
    } catch (error: any) {
      Logger.error(`Error during telemetry sync process: ${error.message || error}`);
    } finally {
      this.isSyncing = false;
      this.notifyListeners(this.getConnectionStatusText(), queue.getQueueSize());
    }
  }

  private async uploadBatch(events: any[], token: string): Promise<boolean> {
    const auth = AuthManager.getInstance();
    const backendUrl = ExtensionConfig.backendUrl;
    const deviceId = auth.getDeviceId();

    const payload = {
      deviceId,
      events
    };

    try {
      const response = await fetch(`${backendUrl}/telemetry/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 200) {
        return true;
      }

      // Handle token expiration: attempt single refresh & retry once
      if (response.status === 401) {
        Logger.warn('Authentication token expired during telemetry sync. Attempting token refresh...');
        const refreshOk = await auth.refreshAccessToken();
        if (refreshOk) {
          const newToken = await auth.getToken();
          if (newToken) {
            // Retry the push
            return await this.uploadBatch(events, newToken);
          }
        }
      }

      Logger.error(`Server rejected telemetry batch: status ${response.status}`);
      return false;
    } catch (error: any) {
      // Connect / Socket errors imply network issues, double the backoff
      this.isOffline = true;
      this.applyBackoff();
      Logger.error(`Sync connection error: ${error.message || error}. Jitter backoff adjusted to ${this.backoffMs}ms`);
      return false;
    }
  }

  private applyBackoff(): void {
    const jitter = Math.random() * 0.1 * this.backoffMs; // 10% random jitter
    this.backoffMs = Math.min(this.backoffMs * 2, this.MAX_BACKOFF_MS) + jitter;
  }

  private getConnectionStatusText(): string {
    if (this.isOffline) { return 'Offline (Retrying)'; }
    return 'Connected';
  }

  private notifyListeners(status: string, queueSize: number): void {
    for (const cb of this.onStatusChangeCallbacks) {
      try {
        cb(status, queueSize);
      } catch {
        // Suppress callback failures
      }
    }
  }
}
