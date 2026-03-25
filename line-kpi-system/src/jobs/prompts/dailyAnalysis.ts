import { MasterCategoryHint } from '../../services/ai/AiAdapter';

export interface ConversationInput {
  conversationId: string;
  startedAt: string;    // HH:MM
  endedAt: string;      // HH:MM
  messages: string;     // pre-formatted transcript lines
}

export interface ConversationCategoryResult {
  conversationId: string;
  category: string;
  summary: string;
}

export interface DailyAnalysisPromptParams {
  groupName: string;
  date: string;
  conversations: ConversationInput[];
  masterCategories?: MasterCategoryHint[];
}

export function buildDailyAnalysisPrompt(params: DailyAnalysisPromptParams): string {
  const { groupName, date, conversations, masterCategories } = params;

  const categoryHints =
    masterCategories && masterCategories.length > 0
      ? `\n\nหมวดหมู่ที่แนะนำ (ใช้ชื่อเหล่านี้ถ้าตรง — สามารถใช้ชื่ออื่นถ้าไม่มีหมวดหมู่ที่เหมาะสม):\n` +
        masterCategories
          .map((c) => {
            let line = `- ${c.name}`;
            if (c.description) line += `: ${c.description}`;
            if (c.keywords && c.keywords.length > 0) line += ` [คำสำคัญ: ${c.keywords.join(', ')}]`;
            return line;
          })
          .join('\n')
      : '';

  const conversationBlocks = conversations
    .map(
      (c, i) =>
        `=== บทสนทนา #${i + 1} [ID: ${c.conversationId}] เวลา ${c.startedAt}–${c.endedAt} ===\n${c.messages}`
    )
    .join('\n\n');

  return `คุณเป็น AI วิเคราะห์การสนทนาของทีม Customer Support
กลุ่ม: ${groupName}
วันที่: ${date}
${categoryHints}

จัดประเภทแต่ละบทสนทนาด้านล่าง และสรุปประเด็นหลักของแต่ละบทสนทนาสั้นๆ (1 ประโยค)

${conversationBlocks}

ตอบกลับเป็น JSON array เท่านั้น (ไม่มีข้อความอื่น):
[
  {
    "conversationId": "<ID ของบทสนทนา>",
    "category": "<หมวดหมู่>",
    "summary": "<สรุปประเด็นหลัก 1 ประโยค>"
  },
  ...
]`;
}
