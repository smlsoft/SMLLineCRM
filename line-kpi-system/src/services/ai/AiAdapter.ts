export interface GroupSummaryResult {
  summaryText: string;
  topIssues: string[];
  sentimentScore?: number;
  promptTokens: number;
  completionTokens: number;
}

export interface StaffKpiResult {
  qualityScore: number;
  kpiNarrative: string;
  strengths: string[];
  areasToImprove: string[];
  promptTokens: number;
  completionTokens: number;
}

export interface GroupSummaryParams {
  groupName: string;
  date: string;
  messageLog: string;
  rawMetrics: {
    totalConversations: number;
    totalMessages: number;
    avgFirstResponseMs?: number;
    avgResponseMs?: number;
  };
}

export interface StaffKpiParams {
  employeeName: string;
  date: string;
  rawMetrics: {
    conversationsHandled: number;
    messagesSent: number;
    avgResponseMs?: number;
    maxResponseMs?: number;
    firstResponseRate?: number;
  };
  sampleMessages: string;
}

export interface IssueCategory {
  category: string;
  count: number;
  percentage: number;
  examples: string[];
  trend: 'up' | 'down' | 'stable' | 'new';
}

export interface IssueAnalysisResult {
  issueCategories: IssueCategory[];
  recurringIssues: string[];
  emergingIssues: string[];
  rootCauseInsight: string;
  recommendedActions: string[];
  promptTokens: number;
  completionTokens: number;
}

export interface IssueAnalysisParams {
  groupName: string;
  date: string;
  messageLog: string;
  previousCategories: string[];
}

export interface ResolutionResult {
  resolution: 'resolved' | 'unresolved';
  reason: string;
  promptTokens: number;
  completionTokens: number;
}

export interface AiAdapter {
  generateGroupSummary(params: GroupSummaryParams): Promise<GroupSummaryResult>;
  evaluateStaffKpi(params: StaffKpiParams): Promise<StaffKpiResult>;
  analyzeIssues(params: IssueAnalysisParams): Promise<IssueAnalysisResult>;
  analyzeResolution(params: import('../../jobs/prompts/resolutionAnalysis').ResolutionAnalysisParams): Promise<ResolutionResult>;
}
