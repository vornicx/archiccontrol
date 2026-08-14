import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hmacHex, secureEqual } from "@/lib/security";

const COOKIE = "archic-control-session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function accessKey(): string {
  if (process.env.CONTROL_ACCESS_KEY) return process.env.CONTROL_ACCESS_KEY;
  if (process.env.NODE_ENV !== "production") return "archic-local";
  throw new Error("CONTROL_ACCESS_KEY must be configured in production");
}

function sessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV !== "production") return "archic-control-local-session-secret-change-me";
  throw new Error("SESSION_SECRET must be configured in production");
}

export function verifyAccessKey(value: string): boolean {
  return secureEqual(value, accessKey());
}

function createToken(expiry: number): string {
  const payload = `vadim.${expiry}`;
  return `${payload}.${hmacHex(sessionSecret(), payload)}`;
}

function verifyToken(token?: string): boolean {
  if (!token) return false;
  const [subject, expiryText, signature] = token.split(".");
  if (subject !== "vadim" || !expiryText || !signature) return false;
  const expiry = Number(expiryText);
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
  return secureEqual(signature, hmacHex(sessionSecret(), `${subject}.${expiryText}`));
}

export async function setSession(): Promise<void> {
  const expiry = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const store = await cookies();
  store.set(COOKIE, createToken(expiry), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function hasSession(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE)?.value);
}

export async function requireSession(): Promise<void> {
  if (!(await hasSession())) redirect("/login");
}

