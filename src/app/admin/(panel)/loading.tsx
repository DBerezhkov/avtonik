"use client";

import { useAdminT } from "@/components/admin/AdminLang";

export default function Loading() {
  return <p className="text-sand-ink">{useAdminT().loading}</p>;
}
