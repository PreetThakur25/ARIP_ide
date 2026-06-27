import * as vscode from 'vscode';
import { AuthManager } from '../authentication/authManager';
import { CommandRegistry } from '../commands/commandRegistry';
import { EventAggregator } from '../events/eventAggregator';
import { AIObserver } from '../observers/aiObserver';
import { BuildObserver } from '../observers/buildObserver';
import { DebugObserver } from '../observers/debugObserver';
import { EditorObserver } from '../observers/editorObserver';
import { GitObserver } from '../observers/gitObserver';
import { IdleObserver } from '../observers/idleObserver';
import { IObserver } from '../observers/baseObserver';
import { WorkspaceObserver } from '../observers/workspaceObserver';
import { EncryptedLocalQueue } from '../queue/localQueue';
import { SyncEngine } from '../queue/syncEngine';
import { SidebarProvider } from '../sidebar/sidebarProvider';
import { StatusbarController } from '../statusbar/statusbarController';
import { Logger } from '../utils/logger';

// List of all active observer services
const observers: IObserver[] = [];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  Logger.info('ARIP Telemetry extension is activating...');

  try {
    // 1. Initialize Auth and Storage modules
    AuthManager.getInstance().init(context);
    await EncryptedLocalQueue.getInstance().init(context);

    // 2. Subscribe local queue to receive events from the Event Aggregator
    context.subscriptions.push(
      EventAggregator.getInstance().registerListener(async (event) => {
        await EncryptedLocalQueue.getInstance().enqueue(event);
      })
    );

    // 3. Initialize Statusbar and Sidebar
    StatusbarController.getInstance().init(context);

    const sidebarProvider = new SidebarProvider(context);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        SidebarProvider.viewType,
        sidebarProvider
      )
    );

    // 4. Register commands
    CommandRegistry.registerAll(context);

    // 5. Initialize and start all independent Observer modules
    observers.push(
      new EditorObserver(),
      new WorkspaceObserver(),
      new AIObserver(),
      new GitObserver(),
      new DebugObserver(),
      new BuildObserver(),
      new IdleObserver()
    );

    for (const observer of observers) {
      observer.start();
    }

    // 6. Start background synchronization
    SyncEngine.getInstance().startSyncLoop();

    Logger.info('ARIP Telemetry extension successfully activated.');
  } catch (error: any) {
    Logger.error(`Activation failed: ${error.message || error}`);
  }
}

export function deactivate(): void {
  Logger.info('Deactivating ARIP Telemetry extension...');
  
  // Stop all background observers
  for (const observer of observers) {
    try {
      observer.stop();
    } catch {
      // Avoid failing during workspace shutdown
    }
  }

  // Stop network loops
  SyncEngine.getInstance().stopSyncLoop();
}
