import * as vscode from 'vscode';
import { BaseObserver } from './baseObserver';

export class AIObserver extends BaseObserver {
  public start(): void {
    // 1. Track text document changes to detect block insertions
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        this.handleTextDocumentChange(e);
      })
    );
  }

  private async handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
    const doc = event.document;
    if (doc.uri.scheme !== 'file') {
      return;
    }

    for (const change of event.contentChanges) {
      const insertedText = change.text;
      
      // Heuristic: A block of code (>15 chars) inserted in a single event
      // that is NOT a manual typing character (usually 1-2 chars)
      if (insertedText.length > 15) {
        // Exclude copy-paste by checking clipboard contents
        const clipboardText = await vscode.env.clipboard.readText().then(text => text, () => '');
        if (insertedText.trim() === clipboardText.trim()) {
          continue;
        }

        // Detect active AI providers by checking installed extensions
        const provider = this.detectAIProvider();
        
        // Grab preceding 5 lines as prompt context metadata
        const startLine = Math.max(0, change.range.start.line - 5);
        const promptSnippetLines: string[] = [];
        for (let i = startLine; i < change.range.start.line; i++) {
          promptSnippetLines.push(doc.lineAt(i).text);
        }
        const promptSnippet = promptSnippetLines.join('\n');

        // Estimate completion metadata
        const lineCount = (insertedText.match(/\n/g) || []).length + 1;
        
        this.publish({
          eventType: 'ai_completion',
          provider,
          model: this.estimateModelForProvider(provider),
          language: doc.languageId,
          promptText: promptSnippet,
          completionText: insertedText,
          accepted: true,
          latency: 400, // standard completion latency estimate
          metadata: {
            linesInserted: lineCount,
            charsInserted: insertedText.length,
            fileName: doc.fileName,
            filePath: doc.uri.fsPath,
            sourceHeuristic: 'block_insertion'
          }
        });
      }
    }
  }

  private detectAIProvider(): string {
    // Inspect active VS Code extensions to identify which AI provider is loaded
    if (vscode.extensions.getExtension('github.copilot')) {
      return 'github-copilot';
    }
    if (vscode.extensions.getExtension('Continue.continue')) {
      return 'continue';
    }
    if (vscode.extensions.getExtension('Codeium.codeium')) {
      return 'codeium';
    }
    if (vscode.extensions.getExtension('RooManiac.roo-cline') || vscode.extensions.getExtension('saoudrizwan.claude-dev')) {
      return 'cline';
    }
    return 'generic-assistant';
  }

  private estimateModelForProvider(provider: string): string {
    switch (provider) {
      case 'github-copilot':
        return 'gpt-4o';
      case 'continue':
        return 'claude-3-5-sonnet';
      case 'codeium':
        return 'codeium-autocode';
      case 'cline':
        return 'claude-3-5-sonnet';
      default:
        return 'default-model';
    }
  }
}
