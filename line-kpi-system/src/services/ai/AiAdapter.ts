import { ConversationInput, ConversationCategoryResult } from '../../jobs/prompts/dailyAnalysis';

export interface MasterCategoryHint {
  name: string;
  description?: string;
  keywords?: string[];
}

export interface DailyConversationAnalysisParams {
  groupName: string;
  date: string;
  conversations: ConversationInput[];
  masterCategories?: MasterCategoryHint[];
}

export interface AdapterConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export type AiTaskName = 'issueAnalysis';

export interface AiAdapter {
  analyzeDailyConversations(params: DailyConversationAnalysisParams): Promise<ConversationCategoryResult[]>;
}
