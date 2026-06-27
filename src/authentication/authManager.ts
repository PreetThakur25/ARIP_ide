import * as vscode from 'vscode';
import { ExtensionConfig } from '../config/settings';
import { DeviceIdHelper } from '../utils/deviceId';
import { Logger } from '../utils/logger';

export class AuthManager {
  private static instance: AuthManager;
  private secrets!: vscode.SecretStorage;
  private globalState!: vscode.Memento;

  private constructor() {}

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  public init(context: vscode.ExtensionContext): void {
    this.secrets = context.secrets;
    this.globalState = context.globalState;
  }

  public getDeviceId(): string {
    return DeviceIdHelper.getOrCreateDeviceId(this.globalState);
  }

  public async getApiKey(): Promise<string | undefined> {
    return await this.secrets.get('arip.apiKey');
  }

  public async getToken(): Promise<string | undefined> {
    return await this.secrets.get('arip.token');
  }

  public async getRefreshToken(): Promise<string | undefined> {
    return await this.secrets.get('arip.refreshToken');
  }

  public async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  public async login(apiKey: string): Promise<boolean> {
    Logger.debug(`Attempting login to backend URL: ${ExtensionConfig.backendUrl}`);
    try {
      const deviceId = this.getDeviceId();
      const response = await fetch(`${ExtensionConfig.backendUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey, deviceId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(`Login handshake failed: ${response.status} ${errorText}`);
        return false;
      }

      const data = (await response.json()) as { token: string; refreshToken?: string };
      if (!data.token) {
        Logger.error('Login request succeeded but returned no access token.');
        return false;
      }

      await this.secrets.store('arip.apiKey', apiKey);
      await this.secrets.store('arip.token', data.token);
      if (data.refreshToken) {
        await this.secrets.store('arip.refreshToken', data.refreshToken);
      } else {
        await this.secrets.delete('arip.refreshToken');
      }

      Logger.info('ARIP Authentication successful. Credentials saved.');
      return true;
    } catch (error: any) {
      Logger.error(`Network or runtime error during login: ${error.message || error}`);
      return false;
    }
  }

  public async refreshAccessToken(): Promise<boolean> {
    Logger.debug('Attempting access token refresh...');
    const refreshToken = await this.getRefreshToken();
    const apiKey = await this.getApiKey();

    if (!refreshToken || !apiKey) {
      Logger.debug('Refresh aborted: missing refresh token or API Key.');
      return false;
    }

    try {
      const response = await fetch(`${ExtensionConfig.backendUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken, apiKey }),
      });

      if (!response.ok) {
        Logger.error(`Token refresh failed: status ${response.status}`);
        return false;
      }

      const data = (await response.json()) as { token: string; refreshToken?: string };
      if (!data.token) {
        Logger.error('Token refresh completed without returning a token.');
        return false;
      }

      await this.secrets.store('arip.token', data.token);
      if (data.refreshToken) {
        await this.secrets.store('arip.refreshToken', data.refreshToken);
      }
      Logger.info('Token refreshed successfully.');
      return true;
    } catch (error: any) {
      Logger.error(`Failed to refresh access token: ${error.message || error}`);
      return false;
    }
  }

  public async logout(): Promise<void> {
    await this.secrets.delete('arip.apiKey');
    await this.secrets.delete('arip.token');
    await this.secrets.delete('arip.refreshToken');
    Logger.info('Logged out. Cleared secrets storage.');
  }
}
