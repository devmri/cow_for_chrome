
import { getLocalValue, setLocalKey, StorageKey } from "./storage";

export type TaskRunStatus = "started" | "completed" | "failed";

export interface TaskRunMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface TaskRunLog {
  id: string; // `${taskId}_${timestamp}`
  taskId: string;
  taskName: string;
  timestamp: number;
  status: TaskRunStatus;
  prompt: string;
  url?: string;
  messages: TaskRunMessage[];
  error?: string;
  duration?: number; // ms，仅在完成/失败时写入
}

export interface TaskStatsItem {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number; // ms
  lastRunDate?: number;
}

type TaskStatsMap = Record<string, TaskStatsItem>;

export class ScheduledTaskLogsService {
  static async startTaskRun(
    taskId: string,
    taskName: string,
    prompt: string,
    url?: string
  ): Promise<TaskRunLog> {
    const log: TaskRunLog = {
      id: `${taskId}_${Date.now()}`,
      taskId,
      taskName,
      timestamp: Date.now(),
      status: "started",
      prompt,
      url,
      messages: [
        {
          role: "system",
          content: `Task "${taskName}" started`,
          timestamp: Date.now(),
        },
      ],
    };
    await this.saveLog(log);
    return log;
  }

  static async addLogMessage(runId: string, message: TaskRunMessage): Promise<void> {
    const all = await this.getAllLogs();
    const found = all.find((l) => l.id === runId);
    if (found) {
      found.messages.push(message);
      await this.saveLogs(all);
    }
  }

  static async updateTaskRunStatus(
    runId: string,
    status: TaskRunStatus,
    error?: string
  ): Promise<void> {
    const all = await this.getAllLogs();
    const found = all.find((l) => l.id === runId);
    if (!found) return;
    found.status = status;
    if (error) found.error = error;
    if (status === "completed" || status === "failed") {
      found.duration = Date.now() - found.timestamp;
    }
    await this.saveLogs(all);
    await this.updateStats(found.taskId, status === "completed");
  }

  static async getTaskLogs(taskId: string): Promise<TaskRunLog[]> {
    return (await this.getAllLogs())
      .filter((l) => l.taskId === taskId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  static async getAllLogs(): Promise<TaskRunLog[]> {
    return (await getLocalValue<TaskRunLog[]>(StorageKey.SCHEDULED_TASK_LOGS)) || [];
  }

  static async saveLog(log: TaskRunLog): Promise<void> {
    const all = await this.getAllLogs();
    all.push(log);
    await this.saveLogs(all);
  }

  static async saveLogs(all: TaskRunLog[]): Promise<void> {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 天
    let filtered = all.filter((l) => l.timestamp > cutoff);

    const perTask = new Map<string, TaskRunLog[]>();
    filtered.forEach((l) => {
      const arr = perTask.get(l.taskId) || [];
      arr.push(l);
      perTask.set(l.taskId, arr);
    });

    // 每个任务最新 50 条
    filtered = [];
    perTask.forEach((arr) => {
      const sorted = arr.sort((a, b) => b.timestamp - a.timestamp);
      filtered.push(...sorted.slice(0, 50));
    });

    // 全部最多 500 条
    filtered = filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, 500);

    await setLocalKey(StorageKey.SCHEDULED_TASK_LOGS, filtered);
  }

  static async updateStats(taskId: string, success: boolean): Promise<void> {
    const stats =
      (await getLocalValue<TaskStatsMap>(StorageKey.SCHEDULED_TASK_STATS)) || {};
    const cur: TaskStatsItem =
      stats[taskId] || {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        averageDuration: 0,
      };
    cur.totalRuns += 1;
    success ? (cur.successfulRuns += 1) : (cur.failedRuns += 1);
    cur.lastRunDate = Date.now();

    const durations = (await this.getTaskLogs(taskId))
      .filter((l) => l.duration)
      .map((l) => l.duration as number);
    if (durations.length > 0) {
      cur.averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    }

    stats[taskId] = cur;
    await setLocalKey(StorageKey.SCHEDULED_TASK_STATS, stats);
  }

  static async getTaskStats(taskId: string): Promise<TaskStatsItem | null> {
    const stats =
      (await getLocalValue<TaskStatsMap>(StorageKey.SCHEDULED_TASK_STATS)) || {};
    return stats[taskId] || null;
  }

  static async exportLogs(taskId?: string): Promise<string> {
    const logs = taskId ? await this.getTaskLogs(taskId) : await this.getAllLogs();
    return JSON.stringify(
      { exportDate: new Date().toISOString(), taskId: taskId || "all", logs },
      null,
      2
    );
  }

  static async clearTaskLogs(taskId: string): Promise<void> {
    const others = (await this.getAllLogs()).filter((l) => l.taskId !== taskId);
    await setLocalKey(StorageKey.SCHEDULED_TASK_LOGS, others);
    const stats =
      (await getLocalValue<TaskStatsMap>(StorageKey.SCHEDULED_TASK_STATS)) || {};
    delete stats[taskId];
    await setLocalKey(StorageKey.SCHEDULED_TASK_STATS, stats);
  }

  static async clearAllLogs(): Promise<void> {
    await chrome.storage.local.remove([
      StorageKey.SCHEDULED_TASK_LOGS,
      StorageKey.SCHEDULED_TASK_STATS,
    ]);
  }
}

export default ScheduledTaskLogsService;

