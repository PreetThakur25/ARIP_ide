import * as vscode from 'vscode';
import { BaseObserver } from './baseObserver';

export class DebugObserver extends BaseObserver {
  private activeSessions: Map<string, { startTime: number; type: string; name: string }> = new Map();

  public start(): void {
    // 1. Observe when a debug session starts
    this.disposables.push(
      vscode.debug.onDidStartDebugSession((session) => {
        this.activeSessions.set(session.id, {
          startTime: Date.now(),
          type: session.type,
          name: session.name
        });

        this.publish({
          eventType: 'debug_session',
          metadata: {
            action: 'start',
            sessionName: session.name,
            debugType: session.type
          }
        });
      })
    );

    // 2. Observe when a debug session terminates
    this.disposables.push(
      vscode.debug.onDidTerminateDebugSession((session) => {
        const active = this.activeSessions.get(session.id);
        if (active) {
          const durationSeconds = Math.round((Date.now() - active.startTime) / 1000);
          this.activeSessions.delete(session.id);

          this.publish({
            eventType: 'debug_session',
            metadata: {
              action: 'stop',
              sessionName: active.name,
              debugType: active.type,
              durationSeconds
            }
          });
        }
      })
    );
  }
}
