import type { NextRequest } from "next/server";
import { readBusy } from "@/lib/data";

/** Занятые даты машины (подтверждённые брони) для календаря на странице машины: GET /api/busy?car=<id>.
 *  Без кеша — сразу после подтверждения брони в админке календарь уже не даёт выбрать эти даты. */
export async function GET(req: NextRequest) {
  const car = Number(req.nextUrl.searchParams.get("car"));
  return Response.json(readBusy()[car] ?? [], { headers: { "Cache-Control": "no-store" } });
}
