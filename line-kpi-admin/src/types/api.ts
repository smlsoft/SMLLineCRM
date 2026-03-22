export interface CustomerGroup {
  _id: string;
  name: string;
  description?: string;
  lineGroupId: string;
  assignedOaId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LineOa {
  _id: string;
  channelId: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  _id: string;
  lineUserId: string;
  name: string;
  employeeCode: string;
  department?: string;
  assignedGroupIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KpiRecord {
  _id: string;
  employeeId: { _id: string; name: string; employeeCode: string; department?: string };
  customerGroupId: { _id: string; name: string };
  date: string;
  conversationsHandled: number;
  resolvedCases: number;
  messagesSent: number;
  avgFirstResponseMs?: number;
  avgResponseMs?: number;
  maxResponseMs?: number;
  firstResponseRate?: number;
  qualityScore?: number;
  kpiNarrative?: string;
  strengths: string[];
  areasToImprove: string[];
  status: 'pending' | 'complete' | 'failed';
}

export interface DailySummary {
  _id: string;
  customerGroupId: { _id: string; name: string };
  date: string;
  totalConversations: number;
  totalMessages: number;
  avgFirstResponseMs?: number;
  avgResponseMs?: number;
  summaryText?: string;
  topIssues: string[];
  sentimentScore?: number;
  status: 'pending' | 'complete' | 'failed';
  generatedAt?: string;
}

export interface IssueCategory {
  category: string;
  count: number;
  percentage: number;
  examples: string[];
  trend: 'up' | 'down' | 'stable' | 'new';
}

export interface IssueReport {
  _id: string;
  customerGroupId: { _id: string; name: string };
  date: string;
  issueCategories: IssueCategory[];
  recurringIssues: string[];
  emergingIssues: string[];
  rootCauseInsight?: string;
  recommendedActions: string[];
  status: 'pending' | 'complete' | 'failed';
  generatedAt?: string;
}

export interface LeaderboardEntry {
  rank: number;
  employee: { _id: string; name: string; employeeCode: string; department?: string };
  avgQualityScore: number;
  avgFirstResponseRate: number;
  avgConversationsHandled: number;
  avgResolvedCases: number;
  compositeScore: number;
  evaluationCount: number;
}

export interface KpiTrendPoint {
  week: string;
  avgQualityScore: number | null;
  avgResponseMs: number | null;
  avgFirstResponseRate: number | null;
  avgConversationsHandled: number | null;
  avgResolvedCases: number | null;
}

export interface Conversation {
  _id: string;
  lineGroupId: string;
  customerGroupId: { _id: string; name: string } | string;
  date: string;
  startedAt: string;
  lastMessageAt: string;
  status: 'open' | 'closed';
  responseStatus?: 'normal' | 'waiting' | 'slow';
  responseStatusOverride?: 'normal' | null;
  lastCustomerMessageAt?: string;
  lastEmployeeMessageAt?: string;
  messageCount: number;
  customerMessageCount: number;
  employeeMessageCount: number;
  avgResponseMs?: number;
  firstResponseMs?: number;
}

export interface GroupedConversationResult {
  data: Conversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Message {
  _id: string;
  conversationId: string;
  lineUserId: string;
  senderDisplayName: string;
  senderType: 'employee' | 'customer';
  employeeId?: { _id: string; name: string; employeeCode: string };
  messageType: string;
  textContent?: string;
  timestamp: string;
}

export interface MonitorEmployee {
  _id: string;
  name: string;
  employeeCode: string;
}

export interface MonitorConversation {
  _id: string;
  responseStatus: 'slow' | 'waiting' | 'normal';
  resolutionStatus: 'resolved' | 'unresolved' | 'pending';
  aiResolutionSuggestion?: 'resolved' | 'unresolved';
  pendingMs: number;
  lastCustomerMessageAt: string | null;
  lastMessageAt: string;
  participantEmployeeIds: string[];
}

export interface MonitorGroup {
  _id: string;
  name: string;
  lineGroupId: string;
  isActive: boolean;
  priorityStatus: 'urgent' | 'warning' | 'normal';
  slowCount: number;
  waitingCount: number;
  openConvCount: number;
  /** ms since the oldest unanswered customer message; null if no pending */
  oldestPendingMs: number | null;
  /** ISO datetime of most recent message across open conversations; null if none */
  lastActivityAt: string | null;
  assignedEmployees: MonitorEmployee[];
  conversations: MonitorConversation[];
}

export interface SystemConfigAiProvider {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface SystemConfig {
  jobs: {
    dailyEvaluation: { enabled: boolean };
    issueAnalysis: { enabled: boolean };
  };
  ai: {
    provider: 'openrouter' | 'kilo';
    openrouter: SystemConfigAiProvider;
    kilo: SystemConfigAiProvider;
  };
  updatedAt: string;
}
