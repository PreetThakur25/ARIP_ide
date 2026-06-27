import * as vscode from 'vscode';
import { ExtensionConfig } from '../config/settings';

export class Logger {
  private static channel: vscode.OutputChannel | undefined;

  private static getChannel(): vscode.OutputChannel {
    if (!Logger.channel) {
      Logger.channel = vscode.window.createOutputChannel('ARIP Telemetry');
    }
    return Logger.channel;
  }

  public static info(message: string): void {
    this.log('INFO', message);
  }

  public static error(message: string): void {
    this.log('ERROR', message);
  }

  public static warn(message: string): void {
    this.log('WARN', message);
  }

  public static debug(message: string): void {
    if (ExtensionConfig.debugLogging) {
      this.log('DEBUG', message);
    }
  }

  private static log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] ${message}`;
    
    // Write to Output Channel
    this.getChannel().appendLine(formatted);
    
    // Also log to console for debugging vscode tests
    if (process.env.VSCODE_EXCLUDE_DEBUG !== 'true') {
      console.log(formatted);
    }
  }

  public static show(): void {
    this.getChannel().show();
  }
}
