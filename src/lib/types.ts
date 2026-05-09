// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Shared Types & Interfaces
// ---------------------------------------------------------------------------

// ── Enums ──────────────────────────────────────────────────────────────────

export enum ItemCategory {
  PLUGIN = 'plugin',
  AGENT = 'agent',
  SKILL = 'skill',
  HOOK = 'hook',
  COMMAND = 'command',
  MCP_SERVER = 'mcp_server',
  RULE = 'rule',
  SESSION = 'session',
  CONFIG = 'config',
}

export enum ItemScope {
  PROJECT = 'project',
  GLOBAL = 'global',
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  UNKNOWN = 'UNKNOWN',
}

// ── Core Dashboard Models ──────────────────────────────────────────────────

export interface DashboardItem {
  /** Composite key: `${scope}:${category}:${name}` */
  id: string;
  category: ItemCategory;
  scope: ItemScope;
  name: string;
  description: string | null;
  filePath: string;
  sourceFile: string;
  /** ISO 8601 */
  lastModified: string;
  metadata: Record<string, string>;
}

export interface InventorySummary {
  totalCount: number;
  counts: Record<ItemCategory, number>;
  items: DashboardItem[];
  /** ISO 8601 timestamp of the scan */
  scannedAt: string;
  projectPath: string | null;
  globalPath: string;
}

export interface DeleteResult {
  deletedId: string;
  deletedFiles: string[];
  trashedTo: string | null;
  settingsModified: boolean;
  inventory: InventorySummary;
}

// ── Export / Import ────────────────────────────────────────────────────────

export interface ExportedFile {
  relativePath: string;
  content: string;
}

export interface ExportedAgent {
  name: string;
  description: string | null;
  files: ExportedFile[];
}

export interface ExportedSkill {
  name: string;
  description: string | null;
  files: ExportedFile[];
}

export interface ExportedHook {
  event: string;
  command: string;
  timeout?: number;
}

export interface ExportedCommand {
  name: string;
  description: string | null;
  files: ExportedFile[];
}

export interface ExportedRule {
  name: string;
  content: string;
  filePath: string;
}

export interface ExportedMcpServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface ExportedPlugin {
  name: string;
  description: string | null;
  files: ExportedFile[];
}

export interface ExportProfile {
  version: number;
  name: string;
  description: string;
  exportedAt: string;
  scope: ItemScope;
  agents: ExportedAgent[];
  skills: ExportedSkill[];
  hooks: ExportedHook[];
  commands: ExportedCommand[];
  rules: ExportedRule[];
  mcpServers: ExportedMcpServer[];
  plugins: ExportedPlugin[];
}

export interface ImportPreviewItem {
  category: ItemCategory;
  name: string;
  action: 'create' | 'overwrite' | 'skip';
  conflictsWith: string | null;
}

export interface ImportPreviewResponse {
  profileName: string;
  description: string;
  items: ImportPreviewItem[];
  totalNew: number;
  totalOverwrite: number;
  totalSkip: number;
}

export interface ImportApplyRequest {
  profile: ExportProfile;
  scope: ItemScope;
  overwrite: boolean;
  selectedItems?: string[];
}

export interface ImportResultItem {
  category: ItemCategory;
  name: string;
  success: boolean;
  action: 'created' | 'overwritten' | 'skipped' | 'failed';
  error?: string;
}

export interface ImportApplyResponse {
  results: ImportResultItem[];
  totalCreated: number;
  totalOverwritten: number;
  totalSkipped: number;
  totalFailed: number;
  inventory: InventorySummary | null;
  backupPath?: string;
}

// ── Bisect (Binary-search Debugging) ───────────────────────────────────────

export interface BisectItem {
  id: string;
  category: ItemCategory;
  name: string;
  enabled: boolean;
}

export interface BisectRound {
  roundNumber: number;
  enabledItems: string[];
  disabledItems: string[];
  userVerdict: 'good' | 'bad' | null;
}

export interface BisectSession {
  sessionId: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  items: BisectItem[];
  rounds: BisectRound[];
  suspectedItem: string | null;
  startedAt: string;
}

export interface BisectRequest {
  action: 'start' | 'good' | 'bad' | 'cancel';
  sessionId?: string;
  categories?: ItemCategory[];
}

export interface BisectResponse {
  session: BisectSession;
  currentRound: BisectRound | null;
  message: string;
}

// ── MCP Tool Cache ─────────────────────────────────────────────────────────

export interface McpToolInfo {
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown>;
  serverName: string;
}

export interface McpToolCache {
  tools: McpToolInfo[];
  cachedAt: string;
  serverName: string;
}

// ── Dependency Graph ───────────────────────────────────────────────────────

export interface DependencyNode {
  id: string;
  category: ItemCategory;
  name: string;
  scope: ItemScope;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'uses' | 'triggers' | 'requires' | 'configures';
}

export interface DependencyGraphResponse {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  circularRefs: string[][];
  generatedAt: string;
}

// ── Profiles ───────────────────────────────────────────────────────────────

export interface ProfileInfo {
  name: string;
  description: string;
  scope: ItemScope;
  itemCount: number;
  createdAt: string;
  filePath: string;
}

export interface ProfileListResponse {
  profiles: ProfileInfo[];
}

export interface ProfileActionRequest {
  action: 'activate' | 'deactivate' | 'delete' | 'duplicate';
  profileName: string;
  newName?: string;
}

export interface ProfileActionResponse {
  success: boolean;
  message: string;
  profiles: ProfileInfo[];
}

// ── Required / Recommended Items ───────────────────────────────────────────

export interface RequiredItem {
  category: ItemCategory;
  name: string;
  reason: string;
  installed: boolean;
}

export interface RecommendedItem {
  category: ItemCategory;
  name: string;
  reason: string;
  installCommand?: string;
}

export type ProjectType = 'nextjs' | 'react' | 'vue' | 'svelte' | 'node' | 'python' | 'rust' | 'go' | 'unknown';

export interface RequiredItemsConfig {
  projectType: ProjectType;
  required: RequiredItem[];
  recommended: RecommendedItem[];
}

// ── Weekly Top 5 & Unused Items ────────────────────────────────────────────

export interface WeeklyTopItem {
  id: string;
  category: ItemCategory;
  name: string;
  usageCount: number;
  lastUsed: string;
}

export interface WeeklyTop5Cache {
  items: WeeklyTopItem[];
  weekStart: string;
  weekEnd: string;
  cachedAt: string;
}

export interface UnusedItem {
  id: string;
  category: ItemCategory;
  name: string;
  lastUsed: string | null;
  daysSinceUsed: number | null;
}

export interface UnusedItemsCache {
  items: UnusedItem[];
  threshold: number;
  cachedAt: string;
}

// ── Token Tracking ─────────────────────────────────────────────────────────

export interface TokenBreakdown {
  category: ItemCategory;
  name: string;
  tokenCount: number;
  percentage: number;
}

export interface TokenActivity {
  timestamp: string;
  totalTokens: number;
  breakdown: TokenBreakdown[];
}

// ── Generic API Wrapper ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  result: boolean;
  data?: T;
  code?: string;
  message?: string;
}
