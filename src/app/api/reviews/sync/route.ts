import { revalidateTag } from "next/cache";
import { syncGoogleReviews } from "@/lib/reviews";

// Автообновление отзывов по расписанию (cron на сервере), например раз в сутки:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://домен/api/reviews/sync
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }
  const result = await syncGoogleReviews();
  if (result.ok) {
    revalidateTag("reviews", "max");
    revalidateTag("settings", "max");
  }
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
