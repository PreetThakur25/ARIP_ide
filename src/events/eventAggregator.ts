import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { AuthManager } from '../authentication/authManager';
import { ExtensionConfig } from '../config/settings';
import { CostEngine } from '../cost/costEngine';
import { TokenEstimationEngine } from '../tokenizer/tokenizerAbstraction';
import { Logger } from '../utils/logger';
import { RawEvent, TelemetryEvent } from './eventTypes';

export class EventAggregator {
  private static instance: EventAggregator;
  private readonly listeners: Set<(event: TelemetryEvent) => void> = new Set();
  private sessionId: string = crypto.randomUUID();
  private workspaceId: string = 'unopened-workspace';

  private constructor() {
    this.calculateWorkspaceId();
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.calculateWorkspaceId();
    });
  }

  public static getInstance(): EventAggregator {
    if (!EventAggregator.instance) {
      EventAggregator.instance = new EventAggregator();
    }
    return EventAggregator.instance;
  }

  public registerListener(listener: (event: TelemetryEvent) => void): vscode.Disposable {
    this.listeners.add(listener);
    return new vscode.Disposable(() => {
      this.listeners.delete(listener);
    });
  }

  public publishRaw(raw: RawEvent): void {
    if (!ExtensionConfig.enableTelemetry) {
      Logger.debug(`Event dropped (telemetry disabled in settings): ${raw.eventType}`);
      return;
    }

    try {
      const auth = AuthManager.getInstance();
      const deviceId = auth.getDeviceId();
      
      // Basic event construction
      const event: TelemetryEvent = {
        eventId: crypto.randomUUID(),
        deviceId,
        workspaceId: this.workspaceId,
        sessionId: this.sessionId,
        eventType: raw.eventType,
        timestamp: new Date().toISOString(),
        provider: raw.provider,
        model: raw.model,
        language: raw.language,
        latency: raw.latency,
        accepted: raw.accepted,
        metadata: raw.metadata || {}
      };

      // Perform Token & Cost Estimation if it is an AI interaction
      if (raw.eventType === 'ai_completion' || raw.eventType === 'ai_chat') {
        const promptText = raw.promptText || '';
        const completionText = raw.completionText || '';

        let promptTokens = 0;
        let completionTokens = 0;

        if (ExtensionConfig.enableTokenEstimation) {
          const tokenizer = TokenEstimationEngine.getInstance();
          const provider = raw.provider || 'unknown';
          const model = raw.model || 'unknown';

          promptTokens = tokenizer.estimate(promptText, provider, model).tokens;
          completionTokens = tokenizer.estimate(completionText, provider, model).tokens;

          event.promptTokens = promptTokens;
          event.completionTokens = completionTokens;
        }

        if (ExtensionConfig.enableCostEstimation) {
          const provider = raw.provider || 'unknown';
          const model = raw.model || 'unknown';
          event.estimatedCost = CostEngine.calculate(promptTokens, completionTokens, provider, model);
        }
      }

      // Privacy Filtering: Clean any raw code/text content & apply hashes if anonymousMode is active
      const cleanedEvent = this.applyPrivacyScrub(event);

      Logger.debug(`Publishing processed event: ${cleanedEvent.eventType} (${cleanedEvent.eventId})`);
      
      // Notify listeners
      for (const listener of this.listeners) {
        listener(cleanedEvent);
      }
    } catch (error: any) {
      Logger.error(`Error processing telemetry event in Aggregator: ${error.message || error}`);
    }
  }

  private applyPrivacyScrub(event: TelemetryEvent): TelemetryEvent {
    const isAnonymous = ExtensionConfig.anonymousMode;
    const metadataCopy = { ...event.metadata };

    // Strict rule: NEVER upload raw prompt text, completion content, or source files
    delete metadataCopy.promptText;
    delete metadataCopy.completionText;
    delete metadataCopy.codeSnippet;

    if (isAnonymous) {
      // Anonymize workspace paths, files, and branch names
      if (metadataCopy.filePath) {
        metadataCopy.filePath = this.hashString(metadataCopy.filePath);
      }
      if (metadataCopy.fileName) {
        metadataCopy.fileName = this.hashString(metadataCopy.fileName);
      }
      if (metadataCopy.gitBranch) {
        metadataCopy.gitBranch = this.hashString(metadataCopy.gitBranch);
      }
      if (metadataCopy.gitCommitHash) {
        metadataCopy.gitCommitHash = this.hashString(metadataCopy.gitCommitHash);
      }
      if (metadataCopy.terminalCommand) {
        // Redact commands that might contain secrets
        metadataCopy.terminalCommand = '[REDACTED_COMMAND]';
      }
    }

    event.metadata = metadataCopy;
    return event;
  }

  private calculateWorkspaceId(): void {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      const paths = folders.map(f => f.uri.fsPath).join(';');
      this.workspaceId = this.hashString(paths);
      Logger.debug(`Hashed active workspace folder path: ${this.workspaceId}`);
    } else {
      this.workspaceId = 'unopened-workspace';
    }
  }

  private hashString(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }
}
