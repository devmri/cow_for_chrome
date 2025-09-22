import { getLocalValue, setLocalKey, StorageKey } from "./storage";

export interface SavedPrompt {
  id: string;
  name?: string;
  command?: string;
  prompt: string;
  categoryId?: string;
  createdAt: number;
  usageCount: number;
  lastUsedAt?: number;
}
export class SavedPromptsService {
  static async getAllPrompts(): Promise<SavedPrompt[]> {
    return (await getLocalValue<SavedPrompt[]>(StorageKey.SAVED_PROMPTS)) || [];
  }

  static async getPromptById(id: string): Promise<SavedPrompt | undefined> {
    return (await this.getAllPrompts()).find((item) => item.id === id);
  }

  static async getPromptByCommand(command: string): Promise<SavedPrompt | undefined> {
    return (await this.getAllPrompts()).find((item) => item.command === command);
  }

  static async savePrompt(prompt: Omit<SavedPrompt, "id" | "createdAt" | "usageCount"> & {
    id?: string;
    createdAt?: number;
    usageCount?: number;
  }): Promise<SavedPrompt> {
    const prompts = await this.getAllPrompts();

    if (prompt.command) {
      const duplicate = prompts.find((item) => item.command === prompt.command);
      if (duplicate) {
        throw new Error(`/${prompt.command} is already in use`);
      }
    }

    const newPrompt: SavedPrompt = {
      ...prompt,
      id: prompt.id ?? `prompt_${Date.now()}`,
      createdAt: prompt.createdAt ?? Date.now(),
      usageCount: prompt.usageCount ?? 0,
    };

    prompts.push(newPrompt);
    await setLocalKey(StorageKey.SAVED_PROMPTS, prompts);
    return newPrompt;
  }

  static async updatePrompt(
    id: string,
    updates: Partial<Omit<SavedPrompt, "id">>
  ): Promise<SavedPrompt | undefined> {
    const prompts = await this.getAllPrompts();
    const index = prompts.findIndex((item) => item.id === id);
    if (index === -1) return undefined;

    if (updates.command && updates.command !== prompts[index].command) {
      const duplicate = prompts.find((item) => item.command === updates.command);
      if (duplicate) {
        throw new Error(`/${updates.command} is already in use`);
      }
    }

    prompts[index] = { ...prompts[index], ...updates };
    await setLocalKey(StorageKey.SAVED_PROMPTS, prompts);
    return prompts[index];
  }

  static async deletePrompt(id: string): Promise<boolean> {
    const prompts = await this.getAllPrompts();
    const filtered = prompts.filter((item) => item.id !== id);
    if (filtered.length === prompts.length) return false;
    await setLocalKey(StorageKey.SAVED_PROMPTS, filtered);
    return true;
  }

  static async recordPromptUsage(id: string): Promise<void> {
    const prompts = await this.getAllPrompts();
    const target = prompts.find((item) => item.id === id);
    if (!target) return;

    target.lastUsedAt = Date.now();
    target.usageCount = (target.usageCount || 0) + 1;
    await setLocalKey(StorageKey.SAVED_PROMPTS, prompts);
  }

  static async searchPrompts(keyword: string): Promise<SavedPrompt[]> {
    const prompts = await this.getAllPrompts();
    const term = keyword.toLowerCase();
    return prompts.filter((item) => {
      const promptMatch = item.prompt.toLowerCase().includes(term);
      const commandMatch = item.command?.toLowerCase().includes(term) ?? false;
      return promptMatch || commandMatch;
    });
  }

  static async exportPrompts(selectedIds?: string[]): Promise<string> {
    const prompts = await this.getAllPrompts();
    const exportList = selectedIds
      ? prompts.filter((item) => selectedIds.includes(item.id))
      : prompts;
    return JSON.stringify(exportList, null, 2);
  }

  static async importPrompts(json: string, replaceExisting = false): Promise<number> {
    const parsed = JSON.parse(json) as SavedPrompt[];
    const existing = replaceExisting ? [] : await this.getAllPrompts();

    const imported = parsed.map((item) => ({
      ...item,
      id: `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      createdAt: Date.now(),
      usageCount: 0,
      lastUsedAt: undefined,
    }));

    const commands = [...existing, ...imported]
      .filter((item) => item.command)
      .map((item) => item.command as string);
    const unique = new Set(commands);
    if (commands.length !== unique.size) {
      throw new Error("Import contains duplicate command shortcuts");
    }

    const merged = [...existing, ...imported];
    await setLocalKey(StorageKey.SAVED_PROMPTS, merged);
    return imported.length;
  }
}

export default SavedPromptsService;
