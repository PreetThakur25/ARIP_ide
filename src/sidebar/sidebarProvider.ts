import * as vscode from 'vscode';
import { AuthManager } from '../authentication/authManager';
import { EventAggregator } from '../events/eventAggregator';
import { SyncEngine } from '../queue/syncEngine';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'arip.sidebar';
  private view?: vscode.WebviewView;

  // Persistent metrics
  private totalTokens: number = 0;
  private totalCost: number = 0;
  private providerCounts: Record<string, number> = {};
  private activeMinutes: number = 0;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.loadStats();
    
    // Listen to incoming events to update the sidebar dashboard in real-time
    this.context.subscriptions.push(
      EventAggregator.getInstance().registerListener((e) => {
        if (e.eventType === 'ai_completion' || e.eventType === 'ai_chat') {
          const prompt = e.promptTokens || 0;
          const completion = e.completionTokens || 0;
          this.totalTokens += (prompt + completion);
          
          if (e.estimatedCost) {
            this.totalCost += e.estimatedCost;
          }

          if (e.provider) {
            this.providerCounts[e.provider] = (this.providerCounts[e.provider] || 0) + 1;
          }

          this.saveStats();
          this.updateWebview();
        } else if (e.eventType === 'editor_activity' && e.metadata?.activeDurationSeconds) {
          this.activeMinutes += Math.round(e.metadata.activeDurationSeconds / 60);
          this.saveStats();
          this.updateWebview();
        }
      })
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Handle messages sent from the webview UI
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'syncNow':
          await SyncEngine.getInstance().triggerSync();
          this.updateWebview();
          break;
        case 'login':
          vscode.commands.executeCommand('arip.login');
          break;
        case 'logout':
          vscode.commands.executeCommand('arip.logout');
          break;
      }
    });

    // Send initial stats down
    this.updateWebview();
  }

  private loadStats(): void {
    const today = new Date().toISOString().substring(0, 10);
    const dateKey = `arip.stats.${today}`;
    const stats = this.context.globalState.get<any>(dateKey, {
      totalTokens: 0,
      totalCost: 0,
      providerCounts: {},
      activeMinutes: 0
    });

    this.totalTokens = stats.totalTokens;
    this.totalCost = stats.totalCost;
    this.providerCounts = stats.providerCounts;
    this.activeMinutes = stats.activeMinutes;
  }

  private saveStats(): void {
    const today = new Date().toISOString().substring(0, 10);
    const dateKey = `arip.stats.${today}`;
    this.context.globalState.update(dateKey, {
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      providerCounts: this.providerCounts,
      activeMinutes: this.activeMinutes
    });
  }

  private getMostUsedProvider(): string {
    let max = 0;
    let mostUsed = 'None';
    for (const [provider, count] of Object.entries(this.providerCounts)) {
      if (count > max) {
        max = count;
        mostUsed = provider;
      }
    }
    return mostUsed;
  }

  private async updateWebview(): Promise<void> {
    if (!this.view) {
      return;
    }

    const auth = AuthManager.getInstance();
    const isLoggedIn = await auth.isAuthenticated();
    const queueSize = require('../queue/localQueue').EncryptedLocalQueue.getInstance().getQueueSize();

    this.view.webview.postMessage({
      type: 'updateStats',
      data: {
        totalTokens: this.totalTokens,
        totalCost: this.totalCost.toFixed(4),
        mostUsedProvider: this.getMostUsedProvider(),
        activeMinutes: this.activeMinutes,
        isLoggedIn,
        queueSize,
        connectionStatus: isLoggedIn ? 'Connected' : 'Offline'
      }
    });
  }

  private getHtmlContent(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ARIP Dashboard</title>
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
      --card-bg: rgba(30, 41, 59, 0.45);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent-primary: #8b5cf6;
      --accent-secondary: #ec4899;
      --accent-success: #10b981;
    }

    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg-gradient);
      color: var(--text-main);
      overflow-x: hidden;
    }

    /* Glassmorphism Title Card */
    .header-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: center;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
    }

    .header-card h2 {
      margin: 0 0 6px 0;
      font-size: 1.5rem;
      background: linear-gradient(to right, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 700;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
    }

    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
    }

    .badge-dot.active {
      background: var(--accent-success);
      box-shadow: 0 0 8px var(--accent-success);
    }

    /* Grid layout for stats */
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(8px);
      border-radius: 12px;
      padding: 14px;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .stat-title {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }

    .stat-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: #ffffff;
    }

    /* Optimization Suggestions box */
    .tips-card {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%);
      border: 1px solid rgba(139, 92, 246, 0.2);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .tips-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #c084fc;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tips-content {
      font-size: 0.8rem;
      line-height: 1.4;
      color: #e2e8f0;
    }

    /* Buttons and controls */
    .button-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    button {
      background: linear-gradient(to right, var(--accent-primary), #6366f1);
      color: #ffffff;
      border: none;
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.85rem;
      transition: opacity 0.2s ease, transform 0.1s ease;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
    }

    button:hover {
      opacity: 0.9;
    }

    button:active {
      transform: scale(0.98);
    }

    button.secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border);
    }

    button.secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  </style>
</head>
<body>

  <div class="header-card">
    <h2>ARIP Resource Monitor</h2>
    <div class="status-badge">
      <div id="statusDot" class="badge-dot"></div>
      <span id="statusText">Disconnected</span>
    </div>
  </div>

  <div class="grid">
    <div class="stat-card">
      <div class="stat-title">Tokens Today</div>
      <div id="tokensVal" class="stat-value">0</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Est. Cost</div>
      <div id="costVal" class="stat-value">$0.0000</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Top Provider</div>
      <div id="providerVal" class="stat-value">None</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Active Time</div>
      <div id="timeVal" class="stat-value">0m</div>
    </div>
  </div>

  <div class="tips-card">
    <div class="tips-title">💡 Optimization Tip</div>
    <div id="tipsText" class="tips-content">
      Start using Copilot or Cline in your editor buffers to analyze prompt costs and track local IDE resource metrics.
    </div>
  </div>

  <div class="button-group">
    <button id="syncBtn">⚡ Sync Telemetry</button>
    <button id="authBtn" class="secondary">Key Authentication</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const tokensVal = document.getElementById('tokensVal');
    const costVal = document.getElementById('costVal');
    const providerVal = document.getElementById('providerVal');
    const timeVal = document.getElementById('timeVal');
    const tipsText = document.getElementById('tipsText');
    
    const syncBtn = document.getElementById('syncBtn');
    const authBtn = document.getElementById('authBtn');

    let loggedIn = false;

    // Listen to messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'updateStats') {
        const data = message.data;
        
        tokensVal.textContent = data.totalTokens.toLocaleString();
        costVal.textContent = '$' + data.totalCost;
        providerVal.textContent = data.mostUsedProvider;
        timeVal.textContent = data.activeMinutes + 'm';
        
        loggedIn = data.isLoggedIn;
        
        if (loggedIn) {
          statusDot.className = 'badge-dot active';
          statusText.textContent = 'Active Ingest';
          authBtn.textContent = 'Logout Session';
        } else {
          statusDot.className = 'badge-dot';
          statusText.textContent = 'Unauthenticated';
          authBtn.textContent = 'Authenticate';
        }

        // Display conditional optimization suggestions
        if (data.totalTokens > 50000) {
          tipsText.textContent = "Your token density is high! Consider using smaller Context Windows or caching imports to lower backend telemetry costs.";
        } else if (data.activeMinutes > 120) {
          tipsText.textContent = "Great coding session! You have maintained a highly active cadence today. Estimated AI assists are contributing effectively.";
        }
      }
    });

    syncBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'syncNow' });
    });

    authBtn.addEventListener('click', () => {
      if (loggedIn) {
        vscode.postMessage({ type: 'logout' });
      } else {
        vscode.postMessage({ type: 'login' });
      }
    });
  </script>
</body>
</html>`;
  }
}
