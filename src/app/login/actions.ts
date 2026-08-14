"use server";

import { redirect } from "next/navigation";
import { setSession, verifyAccessKey } from "@/lib/auth";

export interface LoginState {
  error: string | null;
}

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const value = String(formData.get("accessKey") ?? "");
  if (!verifyAccessKey(value)) return { error: "La clave no es correcta." };
  await setSession();
  redirect("/");
}

