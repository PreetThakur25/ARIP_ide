import * as vscode from 'vscode';
import { BaseObserver } from './baseObserver';

export class EditorObserver extends BaseObserver {
  private typingStats: Map<string, {
    keystrokes: number;
    charsAdded: number;
    charsDeleted: number;
    linesAdded: number;
    linesDeleted: number;
    activeEditingMs: number;
    lastKeyPressTime: number;
  }> = new Map();

  private flushInterval: NodeJS.Timeout | undefined;

  public start(): void {
    // 1. Monitor Text Document Changes (typing, insertions, deletions)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        this.handleTextChange(e);
      })
    );

    // 2. Monitor Active Editor Changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.handleActiveEditorChange(editor);
      })
    );

    // 3. Monitor File Saves
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        this.publish({
          eventType: 'editor_activity',
          language: doc.languageId,
          metadata: {
            action: 'save',
            fileName: doc.fileName,
            filePath: doc.uri.fsPath,
            lineCount: doc.lineCount
          }
        });
      })
    );

    // 4. Setup periodic typing metrics flusher (every 30 seconds)
    this.flushInterval = setInterval(() => {
      this.flushTypingStats();
    }, 30000);
  }

  public override stop(): void {
    super.stop();
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushTypingStats();
  }

  private handleTextChange(event: vscode.TextDocumentChangeEvent): void {
    const doc = event.document;
    if (doc.uri.scheme !== 'file') {
      return;
    }

    const key = doc.uri.fsPath;
    let stats = this.typingStats.get(key);
    if (!stats) {
      stats = {
        keystrokes: 0,
        charsAdded: 0,
        charsDeleted: 0,
        linesAdded: 0,
        linesDeleted: 0,
        activeEditingMs: 0,
        lastKeyPressTime: Date.now()
      };
      this.typingStats.set(key, stats);
    }

    const now = Date.now();
    const timeDelta = now - stats.lastKeyPressTime;
    
    // If typing happens within 3 seconds, count it towards active editing duration
    if (timeDelta < 3000) {
      stats.activeEditingMs += timeDelta;
    }
    stats.lastKeyPressTime = now;
    stats.keystrokes += 1;

    for (const change of event.contentChanges) {
      const addedText = change.text;
      stats.charsAdded += addedText.length;
      stats.charsDeleted += change.rangeLength;

      const linesAdded = (addedText.match(/\n/g) || []).length;
      stats.linesAdded += linesAdded;
      
      const linesDeleted = change.range.end.line - change.range.start.line;
      stats.linesDeleted += linesDeleted;
    }
  }

  private handleActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    if (editor) {
      this.publish({
        eventType: 'editor_activity',
        language: editor.document.languageId,
        metadata: {
          action: 'focus',
          fileName: editor.document.fileName,
          filePath: editor.document.uri.fsPath
        }
      });
    }
  }

  private flushTypingStats(): void {
    const now = Date.now();
    for (const [fsPath, stats] of this.typingStats.entries()) {
      if (stats.keystrokes === 0) {
        continue;
      }

      // Add final keystroke delta if active
      const finalDelta = now - stats.lastKeyPressTime;
      if (finalDelta < 3000) {
        stats.activeEditingMs += finalDelta;
      }

      // Find standard document in open documents if possible
      const doc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === fsPath);
      const language = doc ? doc.languageId : 'unknown';

      this.publish({
        eventType: 'editor_activity',
        language,
        metadata: {
          action: 'typing_summary',
          filePath: fsPath,
          keystrokes: stats.keystrokes,
          charsAdded: stats.charsAdded,
          charsDeleted: stats.charsDeleted,
          linesAdded: stats.linesAdded,
          linesDeleted: stats.linesDeleted,
          activeDurationSeconds: Math.round(stats.activeEditingMs / 1000)
        }
      });
    }
    this.typingStats.clear();
  }
}
