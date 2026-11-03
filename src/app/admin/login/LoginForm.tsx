"use client";

import { useActionState } from "react";
import { login } from "../actions";
import { useAdminT } from "@/components/admin/AdminLang";
import { Field, FormError, SubmitButton } from "@/components/admin/ui";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  const t = useAdminT().login;
  return (
    <form action={action} className="mt-6 space-y-4">
      <FormError error={state?.error} />
      <Field label={t.login} name="login" autoComplete="username" required />
      <Field label={t.password} name="password" type="password" autoComplete="current-password" required />
      <SubmitButton>{t.submit}</SubmitButton>
    </form>
  );
}
