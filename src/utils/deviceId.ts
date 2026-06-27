import * as crypto from 'crypto';
import * as vscode from 'vscode';

export class DeviceIdHelper {
  private static readonly DEVICE_ID_KEY = 'arip.deviceId';

  public static getOrCreateDeviceId(globalState: vscode.Memento): string {
    let deviceId = globalState.get<string>(this.DEVICE_ID_KEY);
    if (!deviceId) {
      // Node 15.6.0+ has randomUUID, fallback to a secure implementation if not present
      if (typeof crypto.randomUUID === 'function') {
        deviceId = crypto.randomUUID();
      } else {
        deviceId = this.generateFallbackUUID();
      }
      globalState.update(this.DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  private static generateFallbackUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
