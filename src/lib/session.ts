import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "autonik_session";
/** Вход из мини-аппа Telegram: админка в компактном виде (только брони). */
export const TG_COOKIE = "admin_tg";
const MAX_AGE = 60 * 60 * 24 * 7; // неделя

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET не задан или короче 32 символов (.env.local)");
  return new TextEncoder().encode(s);
}

/** Роль из токена: admin — вся админка, telegram — вход из мини-аппа, только брони; false — токена нет или он плохой. */
export async function verifyToken(token: string | undefined): Promise<"admin" | "telegram" | false> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.role === "telegram" ? "telegram" : "admin";
  } catch {
    return false;
  }
}

/** telegram — вход из мини-аппа: в Telegram Web он открыт во фрейме, поэтому cookie нужна SameSite=None (только по https). */
export async function createSession({ telegram = false } = {}) {
  const token = await new SignJWT({ role: telegram ? "telegram" : "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const https = !!process.env.SITE_URL?.startsWith("https");
  const opts = {
    httpOnly: true,
    secure: (process.env.NODE_ENV === "production" && https) || (telegram && https),
    sameSite: telegram && https ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: MAX_AGE,
  };
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, opts);
  if (telegram) jar.set(TG_COOKIE, "1", opts);
  else jar.delete(TG_COOKIE);
}

export async function deleteSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(TG_COOKIE);
}

/** Обязательная проверка в каждой странице и server action админки.
 *  scope "bookings" — брони: туда пускаем и вход из мини-аппа Telegram; остальное — только полноценного админа. */
export async function requireAdmin(scope?: "bookings") {
  const role = await verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!role) redirect("/admin/login");
  if (role === "telegram" && scope !== "bookings") redirect("/admin/bookings");
}
