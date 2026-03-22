'use client';

import { MessageSquare } from 'lucide-react';

export default function ConversationsPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant gap-4">
      <div className="w-20 h-20 rounded-3xl bg-surface-container-low flex items-center justify-center">
        <MessageSquare className="w-10 h-10 text-on-surface-variant/50" />
      </div>
      <div className="text-center">
        <p className="text-lg font-headline font-bold text-on-surface/40">เลือกบทสนทนา</p>
        <p className="text-sm mt-1 text-on-surface-variant">คลิกกลุ่มทางซ้ายเพื่อดูแชท</p>
      </div>
    </div>
  );
}
