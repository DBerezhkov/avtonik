"use client";

import { useState } from "react";

/** Удаление в два касания: в Telegram системный confirm() работает не везде.
 *  action уже привязан к заявке в серверном компоненте (.bind в клиентском компоненте вешал next-server). */
export function DeleteButton({ action, label, sure }: { action: () => Promise<void>; label: string; sure: string }) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <form action={action} className="flex-1">
      <button className="h-11 w-full rounded-xl bg-red-600 text-sm font-bold text-white active:bg-red-700">{sure}</button>
    </form>
  ) : (
    <button type="button" onClick={() => setArmed(true)} className="h-11 flex-1 rounded-xl border border-red-200 bg-white text-sm font-bold text-red-600 active:bg-red-50">
      {label}
    </button>
  );
}
