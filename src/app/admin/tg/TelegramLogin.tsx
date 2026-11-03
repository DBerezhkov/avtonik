"use client";

import Script from "next/script";
import { useActionState, useRef, useState } from "react";
import { telegramLogin } from "@/app/admin/actions";

type WebApp = { initData: string; ready: () => void; expand: () => void };

/** Мини-апп Telegram: берём подписанные данные (initData) и отправляем форму входа — пароль не нужен.
 *  signedIn — вход уже есть: только сообщаем Telegram, что страница готова, и разворачиваем на весь экран. */
export function TelegramLogin({ error: notInTelegram, wait, signedIn }: { error: string; wait: string; signedIn?: boolean }) {
  const [state, action, pending] = useActionState(telegramLogin, undefined);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [outside, setOutside] = useState(false);

  // onReady срабатывает и когда скрипт уже был загружен раньше
  const start = () => {
    const app = (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp;
    app?.ready();
    app?.expand();
    if (signedIn) return;
    if (!app?.initData) return setOutside(true); // открыто не из Telegram
    input.current!.value = app.initData;
    form.current?.requestSubmit();
  };

  const error = state?.error ?? (outside ? notInTelegram : "");
  if (signedIn) return <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={start} />;
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={start} />
      <form ref={form} action={action}>
        <input ref={input} type="hidden" name="init_data" />
      </form>
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
      ) : (
        <p className="text-sm text-sand-ink" aria-busy={pending}>{wait}</p>
      )}
    </>
  );
}
