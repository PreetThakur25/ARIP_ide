import * as vscode from 'vscode';
import { BaseObserver } from './baseObserver';

export class WorkspaceObserver extends BaseObserver {
  public start(): void {
    // Perform workspace scan on startup after indexer warms up (e.g., delay 3 seconds)
    setTimeout(() => {
      this.scanWorkspace();
    }, 3000);

    // Watch folders addition or removal
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.scanWorkspace();
      })
    );
  }

  private async scanWorkspace(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      this.publish({
        eventType: 'workspace_metadata',
        metadata: {
          hasWorkspace: false,
          totalFiles: 0
        }
      });
      return;
    }

    try {
      // Find all files, excluding common node_modules/git folders
      // Utilizes the highly optimized VS Code internal indexer
      const files = await vscode.workspace.findFiles(
        '**/*',
        '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.vscode/**}'
      );

      const fileCount = files.length;
      const extensions: Record<string, number> = {};

      for (const file of files) {
        const path = file.fsPath;
        const lastDot = path.lastIndexOf('.');
        if (lastDot !== -1) {
          const ext = path.substring(lastDot).toLowerCase();
          extensions[ext] = (extensions[ext] || 0) + 1;
        } else {
          extensions['no-extension'] = (extensions['no-extension'] || 0) + 1;
        }
      }

      this.publish({
        eventType: 'workspace_metadata',
        metadata: {
          hasWorkspace: true,
          totalFiles: fileCount,
          folderCount: folders.length,
          workspaceNames: folders.map(f => f.name),
          fileExtensions: extensions
        }
      });
    } catch (err: any) {
      // Don't fail the extension activation if workspace scan fails
    }
  }
}
