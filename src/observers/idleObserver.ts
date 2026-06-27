import * as vscode from 'vscode';
import { BaseObserver } from './baseObserver';

export class IdleObserver extends BaseObserver {
  private lastActivityTime: number = Date.now();
  private isIdle: boolean = false;
  private stateTimer: NodeJS.Timeout | undefined;
  
  // Inactivity threshold: default 3 minutes (180,000ms)
  private readonly IDLE_THRESHOLD_MS = 180000;
  private lastStateTransitionTime: number = Date.now();

  public start(): void {
    // 1. Listen to typing and cursor selection changes as signs of activity
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(() => this.recordActivity())
    );
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(() => this.recordActivity())
    );

    // 2. Listen to VS Code window focus changes
    this.disposables.push(
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) {
          this.recordActivity();
        } else {
          this.enterIdleState('window_blur');
        }
      })
    );

    // 3. Start a status polling loop (every 10 seconds) to check for idle timeouts
    this.stateTimer = setInterval(() => {
      this.checkIdleTimeout();
    }, 10000);
  }

  public override stop(): void {
    super.stop();
    if (this.stateTimer) {
      clearInterval(this.stateTimer);
    }
  }

  private recordActivity(): void {
    const now = Date.now();
    if (this.isIdle) {
      const idleDurationSeconds = Math.round((now - this.lastStateTransitionTime) / 1000);
      
      this.publish({
        eventType: 'idle_state',
        metadata: {
          action: 'resume_active',
          idleDurationSeconds,
          reason: 'user_activity'
        }
      });
      
      this.isIdle = false;
      this.lastStateTransitionTime = now;
    }
    this.lastActivityTime = now;
  }

  private checkIdleTimeout(): void {
    const now = Date.now();
    if (!this.isIdle && (now - this.lastActivityTime) >= this.IDLE_THRESHOLD_MS) {
      this.enterIdleState('inactivity_timeout');
    }
  }

  private enterIdleState(reason: 'window_blur' | 'inactivity_timeout'): void {
    if (this.isIdle) {
      return;
    }

    const now = Date.now();
    const activeDurationSeconds = Math.round((now - this.lastStateTransitionTime) / 1000);

    this.publish({
      eventType: 'idle_state',
      metadata: {
        action: 'enter_idle',
        activeDurationSeconds,
        reason
      }
    });

    this.isIdle = true;
    this.lastStateTransitionTime = now;
  }
}
