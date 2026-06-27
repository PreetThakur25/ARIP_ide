import * as assert from 'assert';
import * as vscode from 'vscode';
import { AuthManager } from '../../authentication/authManager';

suite('AuthManager Test Suite', () => {

  suiteSetup(async () => {
    // Obtain active extension context mock or direct access
    const ext = vscode.extensions.getExtension('arip.arip-vscode');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  test('Device ID Generation', () => {
    const auth = AuthManager.getInstance();
    const deviceId1 = auth.getDeviceId();
    const deviceId2 = auth.getDeviceId();
    
    assert.strictEqual(typeof deviceId1, 'string');
    assert.strictEqual(deviceId1.length > 0, true);
    assert.strictEqual(deviceId1, deviceId2, 'Device ID should be persistent and cached');
  });

  test('Initial Authentication State Check', async () => {
    const auth = AuthManager.getInstance();
    // Default mock check or clean run
    const loggedIn = await auth.isAuthenticated();
    assert.strictEqual(typeof loggedIn, 'boolean');
  });

  test('Logout Clears Secrets Storage', async () => {
    const auth = AuthManager.getInstance();
    await auth.logout();
    
    const hasToken = await auth.getToken();
    const hasKey = await auth.getApiKey();

    assert.strictEqual(hasToken, undefined);
    assert.strictEqual(hasKey, undefined);
    assert.strictEqual(await auth.isAuthenticated(), false);
  });
});
