import * as vscode from 'vscode';
import { EventAggregator } from '../events/eventAggregator';
import { SyncEngine } from '../queue/syncEngine';

export class StatusbarController {
  private static instance: StatusbarController;
  private statusBarItem!: vscode.StatusBarItem;

  private sessionCost: number = 0;
  private currentStatus: string = 'Connected';
  private currentQueueSize: number = 0;

  private constructor() {}

  public static getInstance(): StatusbarController {
    if (!StatusbarController.instance) {
      StatusbarController.instance = new StatusbarController();
    }
    return StatusbarController.instance;
  }

  public init(context: vscode.ExtensionContext): void {
    // Create status bar item aligned to the right side
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'arip.syncNow';
    this.statusBarItem.tooltip = 'ARIP: Click to Sync Telemetry Now';
    this.statusBarItem.text = '$(cloud) ARIP: Idle';
    this.statusBarItem.show();
    context.subscriptions.push(this.statusBarItem);

    // Listen to SyncEngine updates
    SyncEngine.getInstance().registerStatusListener((status, queueSize) => {
      this.currentStatus = status;
      this.currentQueueSize = queueSize;
      this.updateStatusBar();
    });

    // Listen to local events to accumulate cost estimates
    context.subscriptions.push(
      EventAggregator.getInstance().registerListener((event) => {
        if (event.estimatedCost) {
          this.sessionCost += event.estimatedCost;
          this.updateStatusBar();
        }
      })
    );
  }

  private updateStatusBar(): void {
    let icon = '$(cloud)';
    let color = new vscode.ThemeColor('statusBar.foreground');

    if (this.currentStatus === 'Syncing...') {
      icon = '$(sync~spin)';
      color = new vscode.ThemeColor('statusBar.debuggingBackground');
    } else if (this.currentStatus.includes('Offline')) {
      icon = '$(cloud-offline)';
      color = new vscode.ThemeColor('statusBarItem.warningForeground');
    }

    const queuePart = this.currentQueueSize > 0 ? ` [${this.currentQueueSize}]` : '';
    const costPart = this.sessionCost > 0 ? ` ($${this.sessionCost.toFixed(3)})` : '';

    this.statusBarItem.text = `${icon} ARIP: ${this.currentStatus}${queuePart}${costPart}`;
    this.statusBarItem.color = color;
  }

  public getSessionCost(): number {
    return this.sessionCost;
  }
}
