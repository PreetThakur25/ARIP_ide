import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AuthManager } from '../authentication/authManager';
import { ExtensionConfig } from '../config/settings';
import { EncryptedLocalQueue } from '../queue/localQueue';
import { SyncEngine } from '../queue/syncEngine';
import { Logger } from '../utils/logger';

export class CommandRegistry {
  public static registerAll(context: vscode.ExtensionContext): void {
    const auth = AuthManager.getInstance();

    // 1. ARIP: Login
    context.subscriptions.push(
      vscode.commands.registerCommand('arip.login', async () => {
        const apiKey = await vscode.window.showInputBox({
          prompt: 'Enter your ARIP API Key',
          placeHolder: 'arip_client_sk_...',
          ignoreFocusOut: true,
          password: true
        });

        if (!apiKey) {
          vscode.window.showWarningMessage('ARIP login cancelled.');
          return;
        }

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'ARIP: Handshaking with backend platform...',
          cancellable: false
        }, async () => {
          const ok = await auth.login(apiKey);
          if (ok) {
            vscode.window.showInformationMessage('Successfully authenticated with ARIP backend!');
            // Start sync loop immediately after login
            SyncEngine.getInstance().startSyncLoop();
          } else {
            vscode.window.showErrorMessage('ARIP Authentication failed. Check your API key and connection.');
          }
        });
      })
    );

    // 2. ARIP: Logout
    context.subscriptions.push(
      vscode.commands.registerCommand('arip.logout', async () => {
        await auth.logout();
        SyncEngine.getInstance().stopSyncLoop();
        vscode.window.showInformationMessage('Successfully logged out from ARIP.');
      })
    );

    // 3. ARIP: Sync Now
    context.subscriptions.push(
      vscode.commands.registerCommand('arip.syncNow', async () => {
        const size = EncryptedLocalQueue.getInstance().getQueueSize();
        if (size === 0) {
          vscode.window.showInformationMessage('ARIP: Local event queue is empty. Nothing to sync.');
          return;
        }

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `ARIP: Synchronizing ${size} queued telemetry events...`,
          cancellable: false
        }, async () => {
          await SyncEngine.getInstance().triggerSync();
        });
      })
    );

    // 4. ARIP: View Analytics
    context.subscriptions.push(
      vscode.commands.registerCommand('arip.viewAnalytics', () => {
        vscode.commands.executeCommand('workbench.view.extension.arip-explorer');
      })
    );

    // 5. ARIP: Open Dashboard
    context.subscriptions.push(
      vscode.commands.registerCommand('arip.openDashboard', () => {
        const url = vscode.Uri.parse('https://arip.io/dashboard');
        vscode.env.openExternal(url);
      })
    );

    // 6. ARIP: Export Logs
    context.subscriptions.push(
      vscode.commands.registerCommand('arip.exportLogs', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          vscode.window.showErrorMessage('No active workspace folder to export logs into.');
          return;
        }

        const exportPath = path.join(workspaceFolders[0].uri.fsPath, 'arip-telemetry-log.txt');
        
        try {
          // Simply export diagnostic state info to log file
          const deviceId = auth.getDeviceId();
          const isLoggedIn = await auth.isAuthenticated();
          const queueSize = EncryptedLocalQueue.getInstance().getQueueSize();
          const backendUrl = ExtensionConfig.backendUrl;

          const logContent = `ARIP Extension Diagnostics Log
Generated At: ${new Date().toISOString()}
-------------------------------------------
Device ID: ${deviceId}
Authenticated: ${isLoggedIn}
Queue Size: ${queueSize}
Backend URL: ${backendUrl}
Telemetry Enabled: ${ExtensionConfig.enableTelemetry}
Token Estimation Enabled: ${ExtensionConfig.enableTokenEstimation}
Cost Estimation Enabled: ${ExtensionConfig.enableCostEstimation}
`;

          fs.writeFileSync(exportPath, logContent, 'utf8');
          vscode.window.showInformationMessage(`Logs exported to: ${exportPath}`);
        } catch (error: any) {
          vscode.window.showErrorMessage(`Failed to export logs: ${error.message || error}`);
        }
      })
    );

    // 7. ARIP: Reset Queue
    context.subscriptions.push(
      vscode.commands.registerCommand('arip.resetQueue', async () => {
        const selection = await vscode.window.showWarningMessage(
          'Are you sure you want to discard all pending offline telemetry events?',
          'Yes', 'No'
        );

        if (selection === 'Yes') {
          await EncryptedLocalQueue.getInstance().reset();
          vscode.window.showInformationMessage('ARIP: Queue reset complete.');
        }
      })
    );

    // 8. ARIP: Test Connection
    context.subscriptions.push(
      vscode.commands.registerCommand('arip.testConnection', async () => {
        const start = Date.now();
        const url = `${ExtensionConfig.backendUrl}/health`;

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'ARIP: Testing connection...',
          cancellable: false
        }, async () => {
          try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 6000);

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(id);

            const latency = Date.now() - start;
            if (res.ok) {
              vscode.window.showInformationMessage(`ARIP Connection Ok! Latency: ${latency}ms`);
            } else {
              vscode.window.showErrorMessage(`ARIP Backend returned status ${res.status}`);
            }
          } catch (error: any) {
            vscode.window.showErrorMessage(`Connection failed: Check backend URL settings. ${error.message || error}`);
          }
        });
      })
    );

    // 9. ARIP: Enable Debug Mode
    context.subscriptions.push(
      vscode.commands.registerCommand('arip.enableDebugMode', async () => {
        await vscode.workspace.getConfiguration('arip').update('debugLogging', true, vscode.ConfigurationTarget.Global);
        Logger.show();
        vscode.window.showInformationMessage('ARIP Debug Mode Enabled. Verbose logs shown in output channel.');
      })
    );
  }
}
