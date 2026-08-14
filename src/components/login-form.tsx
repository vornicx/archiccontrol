"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form className="login-form" action={action}>
      <p className="eyebrow">Private workspace</p>
      <h2>Enter Control</h2>
      <p>One protected boundary for direction, review and approval.</p>
      <div className="field">
        <label htmlFor="accessKey">Owner access key</label>
        <input id="accessKey" name="accessKey" type="password" autoComplete="current-password" required />
      </div>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <button className="button button-primary" disabled={pending} type="submit">
        {pending ? "Verifying…" : "Continue"}
      </button>
    </form>
  );
}

