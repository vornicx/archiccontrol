import "server-only";
import { after } from "next/server";
import { dispatchQueuedTasks } from "@/lib/automation-repository";
import { isGithubAutomationConfigured } from "@/lib/github-app";

export function dispatchQueuedTasksAfterResponse(): void {
  if (!isGithubAutomationConfigured()) return;
  after(async () => {
    try {
      await dispatchQueuedTasks();
    } catch (error) {
      console.error("Archic Control event dispatch failed", error);
    }
  });
}

