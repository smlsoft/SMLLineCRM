import { describe, expect, it } from 'vitest';
import type { CleanMessage } from '../src/client.js';
import { evaluateLayer1 } from '../src/rules/layer1.js';

function msg(
  overrides: Partial<CleanMessage> & Pick<CleanMessage, 'senderType' | 'messageType'>
): CleanMessage {
  return {
    id: overrides.id ?? 'm1',
    conversationId: overrides.conversationId ?? 'conv1',
    senderType: overrides.senderType,
    senderDisplayName:
      overrides.senderDisplayName ??
      (overrides.senderType === 'employee' ? 'Staff A' : 'Customer A'),
    messageType: overrides.messageType,
    textContent: overrides.textContent,
    hasImage: overrides.hasImage ?? overrides.messageType === 'image',
    timestamp: overrides.timestamp ?? '2026-11-19T10:00:00.000Z',
  };
}

const THREE_MIN = 3 * 60_000;

describe('evaluateLayer1', () => {
  it('matches single sticker after employee reply', () => {
    const res = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'customer', messageType: 'text', textContent: 'ออกบิลไม่ได้ครับ', timestamp: '2026-11-19T10:00:00Z' }),
        msg({ senderType: 'employee', messageType: 'text', textContent: 'แก้ไขให้แล้วนะคะ ลองกดใหม่ได้เลย', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'sticker', timestamp: '2026-11-19T10:02:00Z' }),
      ],
    });
    expect(res.matched).toBe(true);
    expect(res.ruleCode).toBe('sticker_only');
    expect(res.needsLayer2).toBe(false);
    expect(res.trailingCount).toBe(1);
  });

  it('matches multiple stickers after employee reply', () => {
    const res = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'ส่งไฟล์ให้แล้วครับ', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'sticker', timestamp: '2026-11-19T10:02:00Z' }),
        msg({ senderType: 'customer', messageType: 'sticker', timestamp: '2026-11-19T10:02:05Z' }),
      ],
    });
    expect(res.matched).toBe(true);
    expect(res.ruleCode).toBe('sticker_only');
    expect(res.trailingCount).toBe(2);
  });

  it('vetoes sticker when no employee has replied yet', () => {
    const res = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'customer', messageType: 'text', textContent: 'สอบถามหน่อยครับ', timestamp: '2026-11-19T10:00:00Z' }),
        msg({ senderType: 'customer', messageType: 'sticker', timestamp: '2026-11-19T10:01:00Z' }),
      ],
    });
    expect(res.matched).toBe(false);
    expect(res.needsLayer2).toBe(true);
  });

  it('matches "ขอบคุณครับ 🙏" after employee reply', () => {
    const res = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'ดำเนินการเรียบร้อยครับ', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'text', textContent: 'ขอบคุณครับ 🙏', timestamp: '2026-11-19T10:02:00Z' }),
      ],
    });
    expect(res.matched).toBe(true);
    expect(res.ruleCode).toBe('closing_phrase');
    expect(res.needsLayer2).toBe(false);
  });

  it('matches "เรียบร้อยแล้วค่ะ" and "ขอบพระคุณมากๆ นะคะ"', () => {
    const res1 = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'ลองดูนะครับ', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'text', textContent: 'เรียบร้อยแล้วค่ะ', timestamp: '2026-11-19T10:02:00Z' }),
      ],
    });
    expect(res1.matched).toBe(true);
    expect(res1.ruleCode).toBe('closing_phrase');

    const res2 = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'ลองดูนะครับ', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'text', textContent: 'ขอบพระคุณมากๆ นะคะ', timestamp: '2026-11-19T10:02:00Z' }),
      ],
    });
    expect(res2.matched).toBe(true);
    expect(res2.ruleCode).toBe('closing_phrase');
  });

  it('matches English closing phrase "OK thanks!"', () => {
    const res = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'Fixed.', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'text', textContent: 'OK thanks!', timestamp: '2026-11-19T10:02:00Z' }),
      ],
    });
    expect(res.matched).toBe(true);
    expect(res.ruleCode).toBe('closing_phrase');
  });

  it('matches multi-message closing "โอเคครับ ได้แล้ว" + sticker', () => {
    const res = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'รีสตาร์ทให้แล้วครับ', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'text', textContent: 'โอเคครับ ได้แล้ว', timestamp: '2026-11-19T10:02:00Z' }),
        msg({ senderType: 'customer', messageType: 'sticker', timestamp: '2026-11-19T10:02:05Z' }),
      ],
    });
    expect(res.matched).toBe(true);
    expect(res.ruleCode).toBe('closing_phrase');
    expect(res.trailingCount).toBe(2);
  });

  it('vetoes gratitude mixed with follow-up question "ขอบคุณครับ แต่ขอถามอีกเรื่อง"', () => {
    const res = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'แก้ให้แล้วค่ะ', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'text', textContent: 'ขอบคุณครับ แต่ขอถามอีกเรื่อง', timestamp: '2026-11-19T10:02:00Z' }),
      ],
    });
    expect(res.matched).toBe(false);
    expect(res.needsLayer2).toBe(true);
  });

  it('vetoes questions like "ได้ไหมครับ" or messages with "?"', () => {
    const res1 = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'เช็คให้แล้วค่ะ', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'text', textContent: 'ได้ไหมครับ', timestamp: '2026-11-19T10:02:00Z' }),
      ],
    });
    expect(res1.matched).toBe(false);
    expect(res1.needsLayer2).toBe(true);

    const res2 = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'เช็คให้แล้วค่ะ', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'text', textContent: 'โอเค?', timestamp: '2026-11-19T10:02:00Z' }),
      ],
    });
    expect(res2.matched).toBe(false);
    expect(res2.needsLayer2).toBe(true);
  });

  it('vetoes bare polite particles like "ครับ" or "ค่ะ"', () => {
    for (const word of ['ครับ', 'ค่ะ', 'นะ']) {
      const res = evaluateLayer1({
        pendingMs: THREE_MIN,
        messages: [
          msg({ senderType: 'employee', messageType: 'text', textContent: 'ส่งข้อมูลเพิ่มเติมมาได้เลยค่ะ', timestamp: '2026-11-19T10:01:00Z' }),
          msg({ senderType: 'customer', messageType: 'text', textContent: word, timestamp: '2026-11-19T10:02:00Z' }),
        ],
      });
      expect(res.matched).toBe(false);
      expect(res.needsLayer2).toBe(true);
    }
  });

  it('vetoes image/file messages sent after employee reply', () => {
    const res = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'ส่งภาพหน้าจอมาได้เลยค่ะ', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'image', timestamp: '2026-11-19T10:02:00Z' }),
      ],
    });
    expect(res.matched).toBe(false);
    expect(res.needsLayer2).toBe(true);
  });

  it('skips when customer idle time is below minIdleMinutes', () => {
    const res = evaluateLayer1({
      pendingMs: 90_000,
      minIdleMinutes: 2,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'เสร็จแล้วค่ะ', timestamp: '2026-11-19T10:01:00Z' }),
        msg({ senderType: 'customer', messageType: 'sticker', timestamp: '2026-11-19T10:02:00Z' }),
      ],
    });
    expect(res.matched).toBe(false);
    expect(res.needsLayer2).toBe(false);
  });

  it('vetoes long customer text over 40 characters', () => {
    const res = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'เรียบร้อยครับ', timestamp: '2026-11-19T10:01:00Z' }),
        msg({
          senderType: 'customer',
          messageType: 'text',
          textContent: 'ขอบคุณครับ เดี่ยวทางเราจะลองเช็คยอดอีกครั้งช่วงบ่ายนะครับ',
          timestamp: '2026-11-19T10:02:00Z',
        }),
      ],
    });
    expect(res.matched).toBe(false);
    expect(res.needsLayer2).toBe(true);
  });

  it('vetoes when trailing customer messages exceed 5 items', () => {
    const res = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'employee', messageType: 'text', textContent: 'รับทราบครับ', timestamp: '2026-11-19T10:00:00Z' }),
        ...Array.from({ length: 6 }, (_, i) =>
          msg({
            id: `s-${i}`,
            senderType: 'customer',
            messageType: 'sticker',
            timestamp: `2026-11-19T10:01:0${i}Z`,
          })
        ),
      ],
    });
    expect(res.matched).toBe(false);
    expect(res.needsLayer2).toBe(true);
  });

  it('returns matched=false and needsLayer2=false when employee replied last', () => {
    const res = evaluateLayer1({
      pendingMs: THREE_MIN,
      messages: [
        msg({ senderType: 'customer', messageType: 'text', textContent: 'สอบถามครับ', timestamp: '2026-11-19T10:00:00Z' }),
        msg({ senderType: 'employee', messageType: 'text', textContent: 'ตอบกลับแล้วครับ', timestamp: '2026-11-19T10:01:00Z' }),
      ],
    });
    expect(res.matched).toBe(false);
    expect(res.needsLayer2).toBe(false);
  });
});
