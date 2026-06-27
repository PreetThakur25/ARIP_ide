import * as vscode from 'vscode';
import { BaseObserver } from './baseObserver';

export class GitObserver extends BaseObserver {
  private gitApi: any | undefined;

  public start(): void {
    try {
      const gitExtension = vscode.extensions.getExtension<any>('vscode.git');
      if (gitExtension) {
        // Activate extension if not active
        if (!gitExtension.isActive) {
          gitExtension.activate().then(() => {
            this.initializeGit(gitExtension.exports);
          });
        } else {
          this.initializeGit(gitExtension.exports);
        }
      }
    } catch {
      // Git is not available in this environment, fail silently
    }
  }

  private initializeGit(gitExtensionExports: any): void {
    try {
      this.gitApi = gitExtensionExports.getAPI(1);
      if (!this.gitApi) {
        return;
      }

      // 1. Observe existing repositories
      for (const repo of this.gitApi.repositories) {
        this.trackRepository(repo);
      }

      // 2. Observe repository open events
      this.disposables.push(
        this.gitApi.onDidOpenRepository((repo: any) => {
          this.trackRepository(repo);
        })
      );
    } catch {
      // Gracefully handle Git API loading failures
    }
  }

  private trackRepository(repo: any): void {
    let lastCommitHash = repo.state.HEAD?.commit;
    let lastBranch = repo.state.HEAD?.name;

    const onStateChange = () => {
      try {
        const head = repo.state.HEAD;
        const currentBranch = head?.name;
        const currentCommitHash = head?.commit;
        const indexChanges = repo.state.indexChanges || [];
        const workingTreeChanges = repo.state.workingTreeChanges || [];

        // Track branch transitions
        if (currentBranch && currentBranch !== lastBranch) {
          this.publish({
            eventType: 'git_activity',
            metadata: {
              action: 'branch_switch',
              fromBranch: lastBranch,
              toBranch: currentBranch,
              stagedFiles: indexChanges.length,
              unstagedFiles: workingTreeChanges.length
            }
          });
          lastBranch = currentBranch;
        }

        // Track commits
        if (currentCommitHash && currentCommitHash !== lastCommitHash) {
          this.publish({
            eventType: 'git_activity',
            metadata: {
              action: 'commit',
              gitBranch: currentBranch,
              gitCommitHash: currentCommitHash,
              stagedFiles: indexChanges.length,
              unstagedFiles: workingTreeChanges.length
            }
          });
          lastCommitHash = currentCommitHash;
        }
      } catch {
        // Fail silently
      }
    };

    // Listen to changes in the repo
    const disposable = repo.state.onDidChange(onStateChange);
    this.disposables.push(disposable);
  }
}
