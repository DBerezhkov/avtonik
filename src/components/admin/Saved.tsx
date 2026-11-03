"use client";

import { useEffect, useState } from "react";
import { useAdminT } from "./AdminLang";

/** Всплывающее «Сохранено» после server action (?saved=… в адресе), само прячется через 3 с. */
export function Saved({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);
  const t = useAdminT();
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, [show]);
  if (!show || !visible) return null;
  return (
    <p role="status" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-6 py-3 text-sm font-bold text-white shadow-xl">
      {t.saved}
    </p>
  );
}
