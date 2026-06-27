import * as vscode from 'vscode';
import { ExtensionConfig } from '../config/settings';
import { TelemetryEvent } from '../events/eventTypes';
import { Logger } from '../utils/logger';
import { EncryptionHelper } from './encryption';

export class EncryptedLocalQueue {
  private static instance: EncryptedLocalQueue;
  private storage!: vscode.Memento;
  private secrets!: vscode.SecretStorage;
  private encryptionKey: string | undefined;

  private readonly QUEUE_KEY = 'arip.queue.events';
  private readonly KEY_STORE_KEY = 'arip.queue.key';

  private constructor() {}

  public static getInstance(): EncryptedLocalQueue {
    if (!EncryptedLocalQueue.instance) {
      EncryptedLocalQueue.instance = new EncryptedLocalQueue();
    }
    return EncryptedLocalQueue.instance;
  }

  public async init(context: vscode.ExtensionContext): Promise<void> {
    this.storage = context.globalState;
    this.secrets = context.secrets;

    // Load or generate encryption key
    let key = await this.secrets.get(this.KEY_STORE_KEY);
    if (!key) {
      key = EncryptionHelper.generateRandomKey();
      await this.secrets.store(this.KEY_STORE_KEY, key);
      Logger.debug('Generated new queue encryption key.');
    }
    this.encryptionKey = key;
  }

  public getQueueSize(): number {
    const rawQueue = this.storage.get<string[]>(this.QUEUE_KEY, []);
    return rawQueue.length;
  }

  public async enqueue(event: TelemetryEvent): Promise<void> {
    if (!this.encryptionKey) {
      Logger.error('Cannot enqueue: encryption key not initialized.');
      return;
    }

    try {
      const plaintext = JSON.stringify(event);
      const encrypted = EncryptionHelper.encrypt(plaintext, this.encryptionKey);

      const rawQueue = this.storage.get<string[]>(this.QUEUE_KEY, []);
      rawQueue.push(encrypted);

      // Enforce max queue boundaries
      const maxQueueSize = ExtensionConfig.maxQueueSize;
      if (rawQueue.length > maxQueueSize) {
        const discardedCount = rawQueue.length - maxQueueSize;
        rawQueue.splice(0, discardedCount);
        Logger.warn(`Local queue exceeded max boundaries. Discarded ${discardedCount} oldest events.`);
      }

      await this.storage.update(this.QUEUE_KEY, rawQueue);
    } catch (error: any) {
      Logger.error(`Failed to enqueue event: ${error.message || error}`);
    }
  }

  public async dequeueBatch(batchSize: number): Promise<TelemetryEvent[]> {
    if (!this.encryptionKey) {
      Logger.error('Cannot dequeue: encryption key not initialized.');
      return [];
    }

    const rawQueue = this.storage.get<string[]>(this.QUEUE_KEY, []);
    const batch = rawQueue.slice(0, batchSize);
    const events: TelemetryEvent[] = [];
    const corruptIndexes: number[] = [];

    for (let i = 0; i < batch.length; i++) {
      try {
        const decrypted = EncryptionHelper.decrypt(batch[i], this.encryptionKey);
        const event = JSON.parse(decrypted) as TelemetryEvent;
        events.push(event);
      } catch (error: any) {
        Logger.error(`Corruption detected on queue index ${i}: ${error.message || error}`);
        corruptIndexes.push(i);
      }
    }

    // Clean corrupt events out of the queue immediately so they don't block subsequent syncs
    if (corruptIndexes.length > 0) {
      const remainingQueue = rawQueue.filter((_, idx) => !corruptIndexes.includes(idx));
      await this.storage.update(this.QUEUE_KEY, remainingQueue);
      Logger.info(`Cleaned ${corruptIndexes.length} corrupted telemetry events from local storage.`);
    }

    return events;
  }

  public async acknowledge(eventIds: string[]): Promise<void> {
    if (!this.encryptionKey) {
      return;
    }

    const rawQueue = this.storage.get<string[]>(this.QUEUE_KEY, []);
    const eventIdSet = new Set(eventIds);
    const newQueue: string[] = [];

    for (const rawEvent of rawQueue) {
      try {
        const decrypted = EncryptionHelper.decrypt(rawEvent, this.encryptionKey);
        const parsed = JSON.parse(decrypted) as TelemetryEvent;
        if (!eventIdSet.has(parsed.eventId)) {
          newQueue.push(rawEvent);
        }
      } catch (error) {
        // Discard failed decrypts
      }
    }

    await this.storage.update(this.QUEUE_KEY, newQueue);
    Logger.debug(`Acknowledged and purged ${eventIds.length} events from queue. Remaining: ${newQueue.length}`);
  }

  public async reset(): Promise<void> {
    await this.storage.update(this.QUEUE_KEY, []);
    Logger.info('Persistent local queue cleared.');
  }
}
