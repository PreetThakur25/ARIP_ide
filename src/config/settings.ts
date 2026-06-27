import * as vscode from 'vscode';

export class ExtensionConfig {
  public static get backendUrl(): string {
    return vscode.workspace.getConfiguration('arip').get<string>('backendUrl', 'https://api.arip.io/v1');
  }

  public static get enableTelemetry(): boolean {
    return vscode.workspace.getConfiguration('arip').get<boolean>('enableTelemetry', true);
  }

  public static get enableTokenEstimation(): boolean {
    return vscode.workspace.getConfiguration('arip').get<boolean>('enableTokenEstimation', true);
  }

  public static get enableCostEstimation(): boolean {
    return vscode.workspace.getConfiguration('arip').get<boolean>('enableCostEstimation', true);
  }

  public static get anonymousMode(): boolean {
    return vscode.workspace.getConfiguration('arip').get<boolean>('anonymousMode', true);
  }

  public static get uploadInterval(): number {
    return vscode.workspace.getConfiguration('arip').get<number>('uploadInterval', 30);
  }

  public static get maxQueueSize(): number {
    return vscode.workspace.getConfiguration('arip').get<number>('maxQueueSize', 1000);
  }

  public static get excludedFolders(): string[] {
    return vscode.workspace.getConfiguration('arip').get<string[]>('excludedFolders', [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.env'
    ]);
  }

  public static get excludedProviders(): string[] {
    return vscode.workspace.getConfiguration('arip').get<string[]>('excludedProviders', []);
  }

  public static get debugLogging(): boolean {
    return vscode.workspace.getConfiguration('arip').get<boolean>('debugLogging', false);
  }
}
