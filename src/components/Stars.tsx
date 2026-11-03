import { t, type Lang } from "@/lib/i18n";

/** Звёзды рейтинга 0–5 (с дробной заливкой). */
export function Stars({ value, className, lang = "ru" }: { value: number; className?: string; lang?: Lang }) {
  const pct = Math.max(0, Math.min(5, value)) * 20;
  return (
    <span className={`relative inline-block leading-none tracking-wider ${className ?? ""}`} role="img" aria-label={t(lang).stars(value)}>
      <span className="text-slate-300">★★★★★</span>
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}
