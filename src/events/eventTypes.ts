export type TelemetryEventType =
  | 'ai_completion'
  | 'ai_chat'
  | 'editor_activity'
  | 'workspace_metadata'
  | 'git_activity'
  | 'debug_session'
  | 'build_task'
  | 'idle_state';

export interface TelemetryEvent {
  eventId: string;          // UUID v4
  userId?: string;          // Hashed user identification
  deviceId: string;         // Unique machine identifier
  workspaceId: string;      // Hashed workspace folder path
  sessionId: string;        // UUID tracking current VS Code window lifecycle
  eventType: TelemetryEventType;
  timestamp: string;        // ISO 8601
  
  // AI specific attributes (optional, depending on eventType)
  provider?: string;        // copilot | cursor | continue | cline | amazon-q | aider | etc.
  model?: string;           // model identifier if known
  language?: string;        // programming language ID
  promptTokens?: number;
  completionTokens?: number;
  estimatedCost?: number;
  latency?: number;         // in milliseconds
  accepted?: boolean;       // for inline suggestions
  
  // Custom structured metadata
  metadata?: Record<string, any>;
}

export interface RawEvent {
  eventType: TelemetryEventType;
  provider?: string;
  model?: string;
  language?: string;
  promptText?: string;
  completionText?: string;
  latency?: number;
  accepted?: boolean;
  metadata?: Record<string, any>;
}
