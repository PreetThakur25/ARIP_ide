import * as assert from 'assert';
import { EncryptionHelper } from '../../queue/encryption';
import { EncryptedLocalQueue } from '../../queue/localQueue';
import { TelemetryEvent } from '../../events/eventTypes';

suite('Queue & Encryption Test Suite', () => {
  test('AES-256-GCM Encryption Cycle', () => {
    const key = EncryptionHelper.generateRandomKey();
    const plaintext = 'Secret telemetry details here';

    const ciphertext = EncryptionHelper.encrypt(plaintext, key);
    assert.notStrictEqual(ciphertext, plaintext);
    assert.strictEqual(typeof ciphertext, 'string');

    const decrypted = EncryptionHelper.decrypt(ciphertext, key);
    assert.strictEqual(decrypted, plaintext, 'Decrypted text must match plaintext');
  });

  test('Decryption with Invalid Key Fails', () => {
    const key1 = EncryptionHelper.generateRandomKey();
    const key2 = EncryptionHelper.generateRandomKey();
    const plaintext = 'Sensitive telemetry';

    const ciphertext = EncryptionHelper.encrypt(plaintext, key1);
    
    assert.throws(() => {
      EncryptionHelper.decrypt(ciphertext, key2);
    }, 'Decrypting with wrong key must raise cipher error');
  });

  test('Queue Enqueue and Dequeue Batch', async () => {
    const queue = EncryptedLocalQueue.getInstance();
    await queue.reset();

    const mockEvent: TelemetryEvent = {
      eventId: 'evt-1234',
      deviceId: 'device-test',
      workspaceId: 'ws-test',
      sessionId: 'session-test',
      eventType: 'editor_activity',
      timestamp: new Date().toISOString()
    };

    await queue.enqueue(mockEvent);
    assert.strictEqual(queue.getQueueSize(), 1);

    const batch = await queue.dequeueBatch(10);
    assert.strictEqual(batch.length, 1);
    assert.strictEqual(batch[0].eventId, 'evt-1234');
    assert.strictEqual(batch[0].eventType, 'editor_activity');

    // Acknowledge and purge
    await queue.acknowledge(['evt-1234']);
    assert.strictEqual(queue.getQueueSize(), 0);
  });
});
