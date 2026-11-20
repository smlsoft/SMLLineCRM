import type { CleanMessage } from '../client.js';

export type Layer1RuleCode = 'sticker_only' | 'closing_phrase';

export interface EvaluateLayer1Input {
  messages: CleanMessage[];
  pendingMs: number;
  minIdleMinutes?: number;
}

export interface EvaluateLayer1Result {
  matched: boolean;
  ruleCode?: Layer1RuleCode;
  reason: string;
  needsLayer2: boolean;
  trailingCount: number;
}

const BLOCKED_MEDIA_TYPES = new Set(['image', 'file', 'video', 'audio', 'location']);

const QUESTION_OR_ISSUE_KEYWORDS = [
  'ไหม',
  'มั้ย',
  'รึยัง',
  'หรือยัง',
  'ยังไง',
  'อย่างไร',
  'ทำไม',
  'เมื่อไหร่',
  'เท่าไหร่',
  'ตรงไหน',
  'อันไหน',
  'ช่วย',
  'รบกวน',
  'สอบถาม',
  'ถาม',
  'ปัญหา',
  'ไม่ได้',
  'ไม่ขึ้น',
  'ไม่ออก',
  'ไม่เข้า',
  'ผิด',
  'ค้าง',
  'เออเร่อ',
  'error',
  'bug',
  'พัง',
  'แก้',
  'ติด',
  'รอ',
  'ด่วน',
  'อีกเรื่อง',
  'อีกนิด',
  'เพิ่มเติม',
  'แต่',
];

const CLOSING_STEMS = [
  'ขอบพระคุณ',
  'ขอบคุณ',
  'ใช้งานได้แล้ว',
  'ใช้ได้แล้ว',
  'แก้ได้แล้ว',
  'ออกได้แล้ว',
  'เรียบร้อยแล้ว',
  'เรียบร้อย',
  'เข้าใจแล้ว',
  'รับทราบ',
  'ทราบแล้ว',
  'ปกติแล้ว',
  'ผ่านแล้ว',
  'ได้แล้ว',
  'ได้เลย',
  'โอเคร',
  'โอเค',
  'thank you',
  'thanks',
  'thank',
  'thx',
  'ty',
  'okay',
  'ok',
  'done',
];

const POLITE_SUFFIXES = [
  'มากๆ',
  'มาก',
  'จัง',
  'เลย',
  'นะครับ',
  'นะคะ',
  'นะคับ',
  'นะค่ะ',
  'คร้าบ',
  'ค้าบ',
  'ครับ',
  'ค่ะ',
  'คะ',
  'คับ',
  'ค่า',
  'จ้า',
  'จ้ะ',
  'น้า',
  'นะ',
  'ๆ',
];

const CLOSING_CLAUSE = `(?:${CLOSING_STEMS.join('|')})(?:\\s*(?:${POLITE_SUFFIXES.join('|')}))*`;
const CLOSING_TEXT_RE = new RegExp(`^${CLOSING_CLAUSE}(?:\\s+${CLOSING_CLAUSE})*$`, 'i');

function normalizeTextForClosingCheck(raw: string): string {
  return raw
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ')
    .replace(/[!~.,…ฯ^_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isClosingPhrase(raw: string): boolean {
  const normalized = normalizeTextForClosingCheck(raw);
  if (!normalized) return false;
  return CLOSING_TEXT_RE.test(normalized);
}

export function evaluateLayer1(input: EvaluateLayer1Input): EvaluateLayer1Result {
  const minIdleMinutes = input.minIdleMinutes ?? 2;
  const minIdleMs = minIdleMinutes * 60_000;

  if (input.pendingMs < minIdleMs) {
    return {
      matched: false,
      needsLayer2: false,
      trailingCount: 0,
      reason: `ลูกค้านิ่งยังไม่ครบ ${minIdleMinutes} นาที`,
    };
  }

  if (input.messages.length === 0) {
    return {
      matched: false,
      needsLayer2: true,
      trailingCount: 0,
      reason: 'ไม่มีประวัติข้อความสำหรับวิเคราะห์',
    };
  }

  const sorted = [...input.messages].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
  );

  let lastEmployeeIdx = -1;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].senderType === 'employee') {
      lastEmployeeIdx = i;
      break;
    }
  }

  if (lastEmployeeIdx === -1) {
    const trailingCustomers = sorted.filter((m) => m.senderType === 'customer').length;
    return {
      matched: false,
      needsLayer2: true,
      trailingCount: trailingCustomers,
      reason: 'ยังไม่มีพนักงานตอบในแชทล่าสุด',
    };
  }

  const trailing = sorted.slice(lastEmployeeIdx + 1);
  if (trailing.length === 0) {
    return {
      matched: false,
      needsLayer2: false,
      trailingCount: 0,
      reason: 'พนักงานเป็นคนตอบล่าสุดแล้ว ไม่ได้ค้างตอบ',
    };
  }

  if (trailing.length > 5) {
    return {
      matched: false,
      needsLayer2: true,
      trailingCount: trailing.length,
      reason: `มีข้อความจากลูกค้าต่อเนื่อง ${trailing.length} ข้อความ (เกินเกณฑ์ชั้นที่ 1)`,
    };
  }

  for (const msg of trailing) {
    if (BLOCKED_MEDIA_TYPES.has(msg.messageType) || (msg.messageType !== 'sticker' && msg.messageType !== 'text')) {
      return {
        matched: false,
        needsLayer2: true,
        trailingCount: trailing.length,
        reason: `ลูกค้าส่งข้อความประเภท [${msg.messageType}] ต้องส่งให้ AI หรือคนตรวจ`,
      };
    }
  }

  if (trailing.every((m) => m.messageType === 'sticker')) {
    return {
      matched: true,
      ruleCode: 'sticker_only',
      needsLayer2: false,
      trailingCount: trailing.length,
      reason:
        trailing.length === 1
          ? 'พนักงานตอบแล้ว และลูกค้าส่งสติ๊กเกอร์ปิดท้ายอย่างเดียว'
          : `พนักงานตอบแล้ว และลูกค้าส่งสติ๊กเกอร์ปิดท้าย ${trailing.length} ข้อความ`,
    };
  }

  const matchedPhrases: string[] = [];

  for (const msg of trailing) {
    if (msg.messageType === 'sticker') continue;

    const raw = (msg.textContent ?? '').trim();
    if (!raw) {
      return {
        matched: false,
        needsLayer2: true,
        trailingCount: trailing.length,
        reason: 'ข้อความไม่มีเนื้อหาตัวอักษรชัดเจน',
      };
    }

    if (raw.includes('?') || raw.includes('？')) {
      return {
        matched: false,
        needsLayer2: true,
        trailingCount: trailing.length,
        reason: 'พบเครื่องหมายคำถามในข้อความลูกค้า',
      };
    }

    if (raw.length > 40) {
      return {
        matched: false,
        needsLayer2: true,
        trailingCount: trailing.length,
        reason: 'ข้อความลูกค้ายาวเกิน 40 ตัวอักษร (ส่งต่อชั้นที่ 2)',
      };
    }

    const lower = raw.toLowerCase();
    const hitKeyword = QUESTION_OR_ISSUE_KEYWORDS.find((kw) => lower.includes(kw));
    if (hitKeyword) {
      return {
        matched: false,
        needsLayer2: true,
        trailingCount: trailing.length,
        reason: `พบคำที่อาจเป็นคำถามหรือปัญหา ("${hitKeyword}")`,
      };
    }

    if (!isClosingPhrase(raw)) {
      return {
        matched: false,
        needsLayer2: true,
        trailingCount: trailing.length,
        reason: `ข้อความ "${raw}" ไม่เข้าเกณฑ์คำปิดท้ายชัดเจน (ส่งต่อชั้นที่ 2)`,
      };
    }

    matchedPhrases.push(raw);
  }

  return {
    matched: true,
    ruleCode: 'closing_phrase',
    needsLayer2: false,
    trailingCount: trailing.length,
    reason: `พนักงานตอบแล้ว และลูกค้าส่งคำขอบคุณ/รับทราบ (${matchedPhrases.join(', ')})`,
  };
}
