import * as vscode from 'vscode';
import { BaseObserver } from './baseObserver';

export class BuildObserver extends BaseObserver {
  private activeTasks: Map<string, { startTime: number; name: string; source: string }> = new Map();

  public start(): void {
    // 1. Monitor when tasks start (e.g., compile, build, test scripts)
    this.disposables.push(
      vscode.tasks.onDidStartTask((e) => {
        const execution = e.execution;
        const task = execution.task;
        const taskKey = this.getTaskKey(task);

        this.activeTasks.set(taskKey, {
          startTime: Date.now(),
          name: task.name,
          source: task.source
        });

        this.publish({
          eventType: 'build_task',
          metadata: {
            action: 'start',
            taskName: task.name,
            taskSource: task.source
          }
        });
      })
    );

    // 2. Monitor when tasks finish
    this.disposables.push(
      vscode.tasks.onDidEndTask((e) => {
        const execution = e.execution;
        const task = execution.task;
        const taskKey = this.getTaskKey(task);

        const active = this.activeTasks.get(taskKey);
        if (active) {
          const durationSeconds = Math.round((Date.now() - active.startTime) / 1000);
          this.activeTasks.delete(taskKey);

          this.publish({
            eventType: 'build_task',
            metadata: {
              action: 'stop',
              taskName: active.name,
              taskSource: active.source,
              durationSeconds
            }
          });
        }
      })
    );
  }

  private getTaskKey(task: vscode.Task): string {
    // Standard task keys are composite values to ensure uniqueness
    return `${task.source}_${task.name}_${task.scope}`;
  }
}
