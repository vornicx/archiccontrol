import "server-only";
import { after } from "next/server";
import { isGithubAutomationConfigured } from "@/lib/github-app";
import { dispatchReadyTasks } from "@/lib/safe-dispatch";

export function dispatchQueuedTasksAfterResponse(): void {
  if (!isGithubAutomationConfigured()) return;
  after(async () => {
    try {
      await dispatchReadyTasks();
    } catch (error) {
      console.error("Archic Control event dispatch failed", error);
    }
  });
}
