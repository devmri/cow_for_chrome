import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { getLocalValue, setLocalKey, StorageKey } from "../../lib/storage";
import ScheduledTaskLogsService from "../../lib/scheduledTasks";
import {
  CirclePlay,
  EllipsisVertical,
  Pencil,
  History as HistoryIcon,
  FileDown,
  Trash2,
  Download,
  X,
  CircleAlert,
  Upload,
  Plus,
} from "lucide-react";

// 任务类型（等价还原）
type RepeatType = "once" | "hourly" | "daily" | "weekdays" | "weekly";
export interface ScheduledTaskItem {
  id: string;
  name: string;
  prompt: string;
  url?: string;
  repeatType: RepeatType;
  intervalMinutes?: number; // hourly
  specificTime?: string; // HH:MM，用于 daily/weekdays/weekly/once
  daysOfWeek?: number[]; // weekly，0=Sun..6=Sat
  enabled: boolean;
  skipPermissions?: boolean;
  lastRun?: number;
  // 派生字段（UI 显示用途）
  nextRun?: number;
}

// 重构前变量名: U（ScheduledTasksTab）
export function ScheduledTasksTab() {
  const [tasks, setTasks] = useState<ScheduledTaskItem[]>([]);
  const [editingTask, setEditingTask] = useState<ScheduledTaskItem | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isImportedReview, setImportedReview] = useState(false);
  const [historyModal, setHistoryModal] = useState<
    | { taskId: string; taskName: string; logs: Awaited<ReturnType<typeof ScheduledTaskLogsService.getTaskLogs>> }
    | null
  >(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // 更新 nextRun（重构前变量名: j）
  const updateNextRuns = useCallback(async (base?: ScheduledTaskItem[]) => {
    const alarms = await chrome.alarms.getAll();
    const arr = (base || tasks).map((t) => {
      const related = alarms.filter((a) => a.name.includes(`task_${t.id}`));
      if (related.length > 0 && t.enabled) {
        const next = Math.min(...related.map((a) => a.scheduledTime));
        return { ...t, nextRun: next } as ScheduledTaskItem;
      }
      return { ...t, nextRun: undefined } as ScheduledTaskItem;
    });
    if (JSON.stringify(arr) !== JSON.stringify(base || tasks)) {
      setTasks(arr);
      await setLocalKey(StorageKey.SCHEDULED_TASKS, arr);
    }
  }, [tasks]);

  // 重新调度全部（重构前变量名: v）
  const rescheduleAll = useCallback(async (list: ScheduledTaskItem[]) => {
    const alarms = await chrome.alarms.getAll();
    for (const a of alarms) if (a.name.startsWith("task_")) await chrome.alarms.clear(a.name);
    for (const t of list) if (t.enabled) scheduleTask(t);
    setTimeout(() => updateNextRuns(list), 500);
  }, [updateNextRuns]);

  // 存储+状态+调度（重构前变量名: N）
  const setAndSaveTasks = useCallback(async (list: ScheduledTaskItem[]) => {
    await setLocalKey(StorageKey.SCHEDULED_TASKS, list);
    setTasks(list);
    rescheduleAll(list);
  }, [rescheduleAll]);

  // 初始加载（重构前变量名: k）
  const loadFromStorage = useCallback(async () => {
    const stored = await getLocalValue<ScheduledTaskItem[]>(StorageKey.SCHEDULED_TASKS);
    if (stored) {
      setTasks(stored);
      setTimeout(async () => {
        const alarms = await chrome.alarms.getAll();
        const arr = stored.map((t) => {
          const related = alarms.filter((a) => a.name.includes(`task_${t.id}`));
          if (related.length > 0 && t.enabled) {
            const next = Math.min(...related.map((a) => a.scheduledTime));
            return { ...t, nextRun: next };
          }
          return { ...t, nextRun: undefined };
        });
        if (JSON.stringify(arr) !== JSON.stringify(stored)) {
          setTasks(arr);
          await setLocalKey(StorageKey.SCHEDULED_TASKS, arr);
        }
      }, 100);
    }
  }, []);

  // 单任务调度（重构前变量名: E）
  function scheduleTask(t: ScheduledTaskItem) {
    const name = `task_${t.id}`;
    if (t.repeatType === "once" && t.specificTime) {
      const when = new Date(t.specificTime).getTime();
      if (when > Date.now()) chrome.alarms.create(name, { when });
    } else if (t.repeatType === "hourly" && t.intervalMinutes) {
      chrome.alarms.create(name, { periodInMinutes: t.intervalMinutes, delayInMinutes: 1 });
    } else if (t.repeatType === "daily" && t.specificTime) {
      const [hh, mm] = t.specificTime.split(":").map(Number);
      const now = new Date();
      const first = new Date();
      first.setHours(hh, mm, 0, 0);
      if (first <= now) first.setDate(first.getDate() + 1);
      chrome.alarms.create(name, { when: first.getTime(), periodInMinutes: 1440 });
    } else if (t.repeatType === "weekdays" && t.specificTime) {
      const [hh, mm] = t.specificTime.split(":").map(Number);
      const now = new Date();
      const weekdays = [1, 2, 3, 4, 5];
      let scheduled = false;
      for (const d of weekdays) {
        const dt = new Date();
        const delta = (d - now.getDay() + 7) % 7;
        if (delta === 0) {
          dt.setHours(hh, mm, 0, 0);
          if (dt <= now) continue;
        } else {
          dt.setDate(now.getDate() + delta);
          dt.setHours(hh, mm, 0, 0);
        }
        if (!scheduled && dt > now) {
          chrome.alarms.create(name, { when: dt.getTime(), periodInMinutes: 1440 });
          scheduled = true;
          break;
        }
      }
      if (!scheduled) {
        const dt = new Date();
        const delta = (1 - now.getDay() + 7) % 7 || 7; // 下周一
        dt.setDate(now.getDate() + delta);
        dt.setHours(hh, mm, 0, 0);
        chrome.alarms.create(name, { when: dt.getTime(), periodInMinutes: 1440 });
      }
    } else if (t.repeatType === "weekly" && t.daysOfWeek && t.specificTime) {
      const [hh, mm] = t.specificTime.split(":").map(Number);
      const now = new Date();
      for (const dow of t.daysOfWeek) {
        const dt = new Date();
        const delta = (dow - now.getDay() + 7) % 7;
        dt.setDate(now.getDate() + (delta || 7));
        dt.setHours(hh, mm, 0, 0);
        if (dt > now) {
          chrome.alarms.create(`${name}_day${dow}`, { when: dt.getTime(), periodInMinutes: 10080 });
        }
      }
    }
  }

  // 运行任务（重构前变量名: A）
  const runTask = useCallback(
    async (taskId: string, manual: boolean = true) => {
      const t = tasks.find((x) => x.id === taskId);
      if (!t) return;
      if (!manual && !t.enabled) return;
      const run = await ScheduledTaskLogsService.startTaskRun(t.id, t.name, t.prompt, t.url);

      if (manual) {
        try {
          const tab = await chrome.tabs.create({ url: t.url || "about:blank", active: true });
          if (!tab.id) return;
          await chrome.sidePanel.setOptions({ tabId: tab.id, path: `src/sidepanel.html?tabId=${encodeURIComponent(tab.id)}`, enabled: true });
          if (tab.id) await chrome.sidePanel.open({ tabId: tab.id });
          const check = async () => {
            try {
              const info = await chrome.tabs.get(tab.id!);
              if (info.status === "complete") {
                setTimeout(() => {
                  chrome.runtime.sendMessage({
                    type: "EXECUTE_SCHEDULED_PROMPT",
                    prompt: t.prompt,
                    taskName: t.name,
                    runLogId: run.id,
                    targetTabId: tab.id,
                    skipPermissions: t.skipPermissions || false,
                  });
                }, 2000);
              } else {
                setTimeout(check, 500);
              }
            } catch {
              // 标签页可能已关闭，忽略
            }
          };
          setTimeout(check, 1000);
        } catch (err: any) {
          await ScheduledTaskLogsService.updateTaskRunStatus(
            run.id,
            "failed",
            err instanceof Error ? err.message : String(err)
          );
        }
      } else {
        chrome.runtime.sendMessage({
          type: "EXECUTE_SCHEDULED_TASK",
          task: { id: t.id, prompt: t.prompt, url: t.url, name: t.name, skipPermissions: t.skipPermissions || false },
          isManual: manual,
          runLogId: run.id,
        });
      }

      const next = tasks.map((x) => (x.id === taskId ? { ...x, lastRun: Date.now() } : x));
      setAndSaveTasks(next);
    },
    [tasks, setAndSaveTasks]
  );

  // 报警监听（重构前变量名: R）
  const setupAlarmListener = useCallback(() => {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name.startsWith("task_")) {
        const id = alarm.name.replace("task_", "");
        runTask(id, false);
      }
    });
  }, [runTask]);

  // nextRun 友好展示（重构前变量名: I）
  function formatNextRun(ts?: number): string {
    if (!ts) return "Not scheduled";
    const when = new Date(ts);
    const delta = ts - Date.now();
    if (delta < 0) return "Overdue";
    if (delta < 60_000) return "Less than a minute";
    if (delta < 60 * 60_000) return `${Math.floor(delta / 60_000)} minutes`;
    if (delta < 24 * 60 * 60_000) return `${Math.floor(delta / (60 * 60_000))} hours`;
    return when.toLocaleString();
  }

  const weekdayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // 重构前变量名: O

  useEffect(() => {
    loadFromStorage();
    setupAlarmListener();
    updateNextRuns();
    const timer = setInterval(() => updateNextRuns(), 30_000);
    const onDocClick = (e: any) => {
      if (!(e.target as HTMLElement).closest(".kebab-menu-container")) setOpenMenuId(null);
    };
    document.addEventListener("click", onDocClick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("click", onDocClick);
    };
  }, [loadFromStorage, setupAlarmListener, updateNextRuns]);

  // 导出配置（与产物等价）
  function exportTaskConfig(t: ScheduledTaskItem) {
    const payload = {
      ...t,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filename = `task_${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}.json`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 导入配置
  function importTask() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (ev: any) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const obj = JSON.parse(String(e.target?.result || "{}"));
          const t: ScheduledTaskItem = {
            id: Date.now().toString(),
            name: obj.name || "Imported Task",
            prompt: obj.prompt || "",
            url: obj.url || "",
            repeatType: (obj.repeatType as RepeatType) || "once",
            intervalMinutes: obj.intervalMinutes,
            specificTime: obj.specificTime,
            daysOfWeek: obj.daysOfWeek,
            enabled: obj.enabled === true,
            skipPermissions: obj.skipPermissions === true,
          };
          setEditingTask(t);
          setImportedReview(true);
          setModalOpen(true);
        } catch {
          alert("Failed to import task config. Please check the file format.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // 任务卡片中的计划描述
  function scheduleSummary(t: ScheduledTaskItem): string {
    switch (t.repeatType) {
      case "once":
        return t.specificTime ? `Once at ${t.specificTime}` : "Once";
      case "hourly":
        return t.intervalMinutes ? `Every ${t.intervalMinutes} minutes` : "Hourly";
      case "daily":
        return t.specificTime ? `Daily at ${t.specificTime}` : "Daily";
      case "weekdays":
        return t.specificTime ? `Weekdays (Mon-Fri) at ${t.specificTime}` : "Weekdays";
      case "weekly":
        return t.specificTime && t.daysOfWeek?.length
          ? `Weekly ${t.daysOfWeek.map((d) => weekdayShort[d]).join(", ")} at ${t.specificTime}`
          : "Weekly";
      default:
        return "";
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="font-xl-bold text-text-100 mb-4">Scheduled Tasks</h2>
        <div className="p-4 bg-bg-100 border border-border-200 rounded-lg mb-4">
          <div className="flex items-start gap-2">
            <CircleAlert className="w-5 h-5 text-accent-secondary-200 mt-0.5 shrink-0" />
            <div className="text-sm text-text-100">
              <p className="font-medium mb-1">Chrome Alarms API Limitations:</p>
              <ul className="list-disc list-inside space-y-1 text-text-200">
                <li>Tasks will only run when Chrome is open</li>
                <li>If Chrome is closed when a task is scheduled, it will run the next time Chrome opens</li>
                <li>Minimum interval between repeating tasks is 1 minute</li>
                <li>Tasks may be delayed by up to 1 minute from scheduled time</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 列表 */}
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="border border-border-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-large text-text-100 truncate" title={t.name}>{t.name || "Untitled task"}</p>
                    {t.enabled ? (
                      <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">enabled</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded bg-bg-200 text-text-200">disabled</span>
                    )}
                  </div>
                  <div className="text-sm text-text-200 mt-1">{scheduleSummary(t)}</div>
                  <div className="text-sm text-text-300 mt-1">
                    Next run: {formatNextRun(t.nextRun)}
                  </div>
                </div>
                <div className="relative kebab-menu-container">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === t.id ? null : t.id);
                    }}
                    className="p-2 text-text-200 hover:bg-bg-100 rounded"
                    title="More actions"
                  >
                    <EllipsisVertical className="w-4 h-4" />
                  </button>
                  {openMenuId === t.id && (
                    <div className="absolute right-0 top-full mt-1 bg-bg-000 border border-border-200 rounded-lg shadow-lg z-10 min-w-48">
                      <button
                        onClick={() => {
                          runTask(t.id);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-text-000 hover:bg-bg-100 flex items-center gap-2"
                      >
                        <CirclePlay className="w-4 h-4" />
                        Run Now
                      </button>
                      <button
                        onClick={() => {
                          setEditingTask(t);
                          setModalOpen(true);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-text-000 hover:bg-bg-100 flex items-center gap-2"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit Task
                      </button>
                      <button
                        onClick={async () => {
                          const logs = await ScheduledTaskLogsService.getTaskLogs(t.id);
                          setHistoryModal({ taskId: t.id, taskName: t.name, logs });
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-text-000 hover:bg-bg-100 flex items-center gap-2"
                      >
                        <HistoryIcon className="w-4 h-4" />
                        View Run History
                      </button>
                      <button
                        onClick={() => {
                          exportTaskConfig(t);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-text-000 hover:bg-bg-100 flex items-center gap-2"
                      >
                        <FileDown className="w-4 h-4" />
                        Export Config
                      </button>
                      <hr className="my-1" />
                      <button
                        onClick={() => {
                          const left = tasks.filter((x) => x.id !== t.id);
                          setAndSaveTasks(left);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-danger-000 hover:bg-danger-900 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Task
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="text-center py-8 text-text-300">
              No scheduled tasks yet. Click the button below to add one.
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => {
            const t: ScheduledTaskItem = {
              id: Date.now().toString(),
              name: "",
              prompt: "",
              url: "",
              repeatType: "once",
              enabled: false,
              skipPermissions: false,
            };
            setEditingTask(t);
            setModalOpen(true);
          }}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-accent-main-200 text-oncolor-100 rounded-lg hover:bg-accent-main-100 active:bg-accent-main-100 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Scheduled Task
        </button>
        <button
          onClick={importTask}
          className="flex items-center justify-center gap-2 py-2 px-4 border border-border-300 text-text-100 rounded-lg hover:bg-bg-100 active:bg-bg-200 active:scale-[0.98] transition-all"
        >
          <Upload className="w-4 h-4" />
          Import Task
        </button>
      </div>

      {/* 新建/编辑/导入 审阅弹窗 */}
      {isModalOpen && editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-bg-000 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-text-100">
              {isImportedReview
                ? "Review Imported Task"
                : tasks.find((x) => x.id === editingTask.id)
                ? "Edit"
                : "Add"}{" "}
              Scheduled Task
            </h3>

            {isImportedReview && (
              <div className="mb-4 p-4 bg-accent-secondary-900 border border-accent-secondary-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <CircleAlert className="w-5 h-5 text-accent-secondary-200 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-text-100 mb-1">Security Notice</p>
                    <p className="text-text-200">
                      Please verify the prompt and URL from imported file before saving.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 表单 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-text-100">Task name</label>
                <input
                  type="text"
                  value={editingTask.name}
                  onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border-200 rounded-md bg-bg-000 text-text-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-text-100">Prompt</label>
                <textarea
                  value={editingTask.prompt}
                  onChange={(e) => setEditingTask({ ...editingTask, prompt: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-border-200 rounded-md bg-bg-000 text-text-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-text-100">Target URL (optional)</label>
                <input
                  type="text"
                  value={editingTask.url || ""}
                  onChange={(e) => setEditingTask({ ...editingTask, url: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-border-200 rounded-md bg-bg-000 text-text-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-text-100">Repeat</label>
                <select
                  value={editingTask.repeatType}
                  onChange={(e) => setEditingTask({ ...editingTask, repeatType: e.target.value as RepeatType })}
                  className="w-full px-3 py-2 border border-border-200 rounded-md bg-bg-000 text-text-100"
                >
                  <option value="once">Once</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              {editingTask.repeatType === "hourly" && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-text-100">Interval (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    value={editingTask.intervalMinutes || 60}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, intervalMinutes: Math.max(1, Number(e.target.value || 0)) })
                    }
                    className="w-full px-3 py-2 border border-border-200 rounded-md bg-bg-000 text-text-100"
                  />
                </div>
              )}

              {(editingTask.repeatType === "once" || editingTask.repeatType === "daily" || editingTask.repeatType === "weekdays" || editingTask.repeatType === "weekly") && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-text-100">Time (HH:MM)</label>
                  <input
                    type="time"
                    value={editingTask.specificTime || ""}
                    onChange={(e) => setEditingTask({ ...editingTask, specificTime: e.target.value })}
                    className="w-full px-3 py-2 border border-border-200 rounded-md bg-bg-000 text-text-100"
                  />
                </div>
              )}

              {editingTask.repeatType === "weekly" && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-text-100">Days of Week</label>
                  <div className="flex gap-2">
                    {weekdayShort.map((lab, i) => (
                      <label key={i} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editingTask.daysOfWeek?.includes(i) || false}
                          onChange={(e) => {
                            const cur = editingTask.daysOfWeek || [];
                            if (e.target.checked) {
                              setEditingTask({ ...editingTask, daysOfWeek: [...cur, i] });
                            } else {
                              setEditingTask({ ...editingTask, daysOfWeek: cur.filter((x) => x !== i) });
                            }
                          }}
                          className="mr-1"
                        />
                        {lab}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-100">Enable task immediately</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTask.enabled}
                    onChange={(e) => setEditingTask({ ...editingTask, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-bg-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-bg-000 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-main-200" />
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-text-100">Skip permissions</span>
                  <span className="text-xs text-danger-200 mt-1">⚠️ Dangerous: Bypasses all permission prompts</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTask.skipPermissions || false}
                    onChange={(e) => setEditingTask({ ...editingTask, skipPermissions: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-bg-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-bg-000 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-danger-200" />
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  if (!editingTask || !editingTask.name || !editingTask.prompt) return;
                  const exists = tasks.find((x) => x.id === editingTask.id);
                  const next = exists
                    ? tasks.map((x) => (x.id === editingTask.id ? editingTask : x))
                    : [...tasks, editingTask];
                  setAndSaveTasks(next);
                  setEditingTask(null);
                  setModalOpen(false);
                  setImportedReview(false);
                }}
                className="flex-1 py-2 px-4 bg-accent-main-200 text-oncolor-100 rounded-md hover:bg-accent-main-100 active:bg-accent-main-100 active:scale-[0.98] transition-all"
              >
                {isImportedReview ? "Import Task" : "Save Task"}
              </button>
              <button
                onClick={() => {
                  setEditingTask(null);
                  setModalOpen(false);
                  setImportedReview(false);
                }}
                className="flex-1 py-2 px-4 border border-border-300 rounded-md hover:bg-bg-100 text-text-100 active:bg-bg-200 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 运行历史弹窗 */}
      {historyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-bg-000 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Run History: {historyModal.taskName}</h3>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const content = await ScheduledTaskLogsService.exportLogs(historyModal.taskId);
                    const now = new Date();
                    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
                    const filename = `${historyModal.taskName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}_${ts}.json`;
                    const blob = new Blob([content], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="p-2 text-accent-main-200 hover:bg-bg-100 rounded"
                  title="Export Logs"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setHistoryModal(null)}
                  className="p-2 text-text-200 hover:bg-bg-100 rounded"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              {historyModal.logs.length === 0 ? (
                <div className="text-center py-8 text-text-300">No run history available yet</div>
              ) : (
                historyModal.logs.map((log) => (
                  <div key={log.id} className="border border-border-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "inline-block px-2 py-1 text-xs font-medium rounded " +
                              (log.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : log.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : log.status === "started"
                                ? "bg-accent-main-900 text-accent-main-200"
                                : "bg-bg-200 text-text-200")
                            }
                          >
                            {log.status}
                          </span>
                          <span className="text-sm text-text-200">{new Date(log.timestamp).toLocaleString()}</span>
                          {log.duration && (
                            <span className="text-sm text-text-200">• {Math.round(log.duration / 1000)}s</span>
                          )}
                        </div>
                        {log.error && (
                          <div className="text-danger-000 text-sm mt-1">Error: {log.error}</div>
                        )}
                      </div>
                    </div>
                    {log.prompt && (
                      <div className="mt-2">
                        <div className="text-xs text-text-300">Prompt:</div>
                        <pre className="mt-1 p-2 bg-bg-100 rounded border border-border-200 overflow-auto text-xs text-text-200 whitespace-pre-wrap">{log.prompt}</pre>
                      </div>
                    )}
                    {log.url && (
                      <div className="mt-2 text-xs text-text-300">URL: {log.url}</div>
                    )}
                  </div>
                ))
              )}
            </div>
            {historyModal.logs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border-200 flex justify-between items-center">
                <div className="text-sm text-text-200">Showing {historyModal.logs.length} run(s)</div>
                <button
                  onClick={async () => {
                    if (confirm("Are you sure you want to clear all logs for this task?")) {
                      await ScheduledTaskLogsService.clearTaskLogs(historyModal.taskId);
                      setHistoryModal(null);
                    }
                  }}
                  className="text-sm text-danger-200 hover:text-danger-100"
                >
                  Clear All Logs
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
