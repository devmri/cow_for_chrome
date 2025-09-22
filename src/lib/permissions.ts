// 重构前变量名: Dn（ToolAction）
// 重构前变量名: Tn（PermissionAction）
// 重构前变量名: An（PermissionDuration）
// 重构前变量名: Rn（actionVerb）
// 重构前变量名: Ln（permissionService）

import { getLocalValue, setLocalObject, StorageKey } from "./storage";

// 工具操作类型（与产物字符串值等价）
export enum ToolAction {
  NAVIGATE = "navigate",
  READ_PAGE_CONTENT = "read_page_content",
  CLICK = "click",
  TYPE = "type",
  DOMAIN_TRANSITION = "domain_transition",
}

// 许可结果（允许/拒绝）
export enum PermissionAction {
  ALLOW = "allow",
  DENY = "deny",
}

// 许可时长（一次/总是）
export enum PermissionDuration {
  ONCE = "once",
  ALWAYS = "always",
}

// 权限作用域
export type NetlocScope = { type: "netloc"; netloc: string };
export type DomainTransitionScope = {
  type: "domain_transition";
  fromDomain: string;
  toDomain: string;
};
export type PermissionScope = NetlocScope | DomainTransitionScope;

export interface PermissionItem {
  id: string;
  scope: PermissionScope;
  action: PermissionAction;
  duration: PermissionDuration;
  createdAt: number;
  lastUsed?: number;
  toolUseId?: string;
}

export type PermissionStorage = { permissions: PermissionItem[] };

export function actionVerb(action: ToolAction): string {
  return (
    {
      navigate: "navigate to",
      read_page_content: "read page content on",
      click: "click on",
      type: "type text into",
      domain_transition: "navigate from",
    } as const
  )[action];
}

type CheckResult = {
  allowed: boolean;
  permission?: PermissionItem;
  needsPrompt?: boolean;
};

export class PermissionsManager {
  // 所有授权项
  private permissions: PermissionItem[] = [];
  // 结果缓存：`${host}:${toolUseId || 'no-tool'}` → PermissionItem
  private cache = new Map<string, PermissionItem>();
  // 是否允许跳过所有权限（由外部策略控制，例如某些实验开关）
  private canSkipPermissions = false;
  // 是否强制弹窗（覆盖 canSkipPermissions）
  private forcePrompt = false;
  // 外部注入的“是否跳过所有权限”判定
  private readonly getSkipAllPermissions: () => boolean;

  constructor(getSkipAllPermissions: () => boolean = () => false) {
    this.getSkipAllPermissions = getSkipAllPermissions;
    this.loadPermissions();
    this.setupStorageListener();
  }

  // 设置“是否可跳过权限提示”的策略位
  setCanSkipPermissions(v: boolean) {
    this.canSkipPermissions = v;
  }

  // 设置“是否强制弹窗”的策略位
  setForcePrompt(v: boolean) {
    this.forcePrompt = v;
  }

  // 按主机名与（可选）toolUseId 检查权限
  async checkPermission(url: string, toolUseId?: string): Promise<CheckResult> {
    // 支持“跳过所有权限”
    if (!this.forcePrompt && this.canSkipPermissions && this.getSkipAllPermissions()) {
      return { allowed: true, permission: undefined };
    }

    await this.loadPermissions();
    const { host } = new URL(url);
    const found = this.findApplicablePermission(host, toolUseId);
    if (found) {
      found.lastUsed = Date.now();
      await this.savePermissions();
      return {
        allowed: found.action === PermissionAction.ALLOW,
        permission: found,
      };
    }
    // 未命中任何授权项 → 需要弹窗
    return { allowed: false, needsPrompt: true };
  }

  async hasSiteWidePermissions(host: string): Promise<boolean> {
    await this.loadPermissions();
    return this.permissions.some(
      (permission) =>
        permission.scope.type === "netloc" &&
        permission.duration === PermissionDuration.ALWAYS &&
        permission.action === PermissionAction.ALLOW &&
        !!permission.scope.netloc &&
        this.matchesNetloc(host, permission.scope.netloc)
    );
  }

  // 域名迁移（from → to）权限检查
  async checkDomainTransition(
    fromDomain: string,
    toDomain: string
  ): Promise<CheckResult> {
    if (this.forcePrompt) return { allowed: false, needsPrompt: true };
    await this.loadPermissions();
    const candidates = this.permissions.filter(
      (p) =>
        p.scope.type === "domain_transition" &&
        p.scope.fromDomain === fromDomain &&
        p.scope.toDomain === toDomain
    );
    const denied = candidates.find((p) => p.action === PermissionAction.DENY);
    if (denied) {
      denied.lastUsed = Date.now();
      await this.savePermissions();
      return { allowed: false, permission: denied };
    }
    const allowed = candidates.find((p) => p.action === PermissionAction.ALLOW);
    if (allowed) {
      allowed.lastUsed = Date.now();
      await this.savePermissions();
      return { allowed: true, permission: allowed };
    }
    return { allowed: false, needsPrompt: true };
  }

  // 授权（允许）
  async grantPermission(
    scope: PermissionScope,
    duration: PermissionDuration,
    toolUseId?: string
  ): Promise<void> {
    const item: PermissionItem = {
      id: crypto.randomUUID(),
      scope,
      action: PermissionAction.ALLOW,
      duration,
      createdAt: Date.now(),
      toolUseId: duration === PermissionDuration.ONCE ? toolUseId : undefined,
    };
    this.permissions.push(item);
    await this.savePermissions();
    this.clearCache();
  }

  // 拒绝（仅对 ALWAYS 持久化；与产物等价）
  async denyPermission(
    scope: PermissionScope,
    duration: PermissionDuration
  ): Promise<void> {
    if (duration === PermissionDuration.ONCE) return;
    const item: PermissionItem = {
      id: crypto.randomUUID(),
      scope,
      action: PermissionAction.DENY,
      duration,
      createdAt: Date.now(),
    };
    if (duration === PermissionDuration.ALWAYS) this.permissions.push(item);
    await this.savePermissions();
    this.clearCache();
  }

  async revokePermission(id: string): Promise<void> {
    this.permissions = this.permissions.filter((p) => p.id !== id);
    await this.savePermissions();
    this.clearCache();
  }

  async clearAllPermissions(): Promise<void> {
    this.permissions = [];
    await this.savePermissions();
    this.clearCache();
  }

  async clearOncePermissions(): Promise<void> {
    const prev = this.permissions.length;
    this.permissions = this.permissions.filter(
      (p) => p.duration !== PermissionDuration.ONCE
    );
    if (prev - this.permissions.length > 0) {
      await this.savePermissions();
      this.clearCache();
    }
  }

  // 与编译产物等价：手动刷新本地缓存（重构前方法名: loadPermissions）
  async refreshFromStorage(): Promise<void> {
    await this.loadPermissions();
  }

  getPermissionsByScope(): {
    netloc: PermissionItem[];
    domain_transition: PermissionItem[];
  } {
    return {
      netloc: this.permissions.filter((p) => p.scope.type === "netloc"),
      domain_transition: this.permissions.filter(
        (p) => p.scope.type === "domain_transition"
      ),
    };
  }

  getAllPermissions(): PermissionItem[] {
    return [...this.permissions];
  }

  // 查找适用的权限项（缓存 + 一次性消费逻辑）
  private findApplicablePermission(
    host: string,
    toolUseId?: string
  ): PermissionItem | null {
    const cacheKey = `${host}:${toolUseId || "no-tool"}`;
    if (this.cache.has(cacheKey))
      return this.cache.get(cacheKey) as PermissionItem;

    // 优先消费“一次性授权”
    if (toolUseId) {
      const once = this.permissions.find(
        (p) =>
          p.duration === PermissionDuration.ONCE &&
          p.toolUseId === toolUseId &&
          p.scope.type === "netloc" &&
          !!p.scope.netloc &&
          this.matchesNetloc(host, p.scope.netloc)
      );
      if (once) {
        // 与产物等价：命中一次性授权后即撤销
        this.revokePermission(once.id);
        return once;
      }
    }

    // 其他持久授权项（非 ONCE）
    const applicable = this.permissions.filter(
      (p) =>
        p.scope.type === "netloc" &&
        p.duration !== PermissionDuration.ONCE &&
        !!p.scope.netloc &&
        this.matchesNetloc(host, p.scope.netloc)
    );
    const denied = applicable.find((p) => p.action === PermissionAction.DENY);
    if (denied) {
      this.cache.set(cacheKey, denied);
      return denied;
    }
    const allowed = applicable.find((p) => p.action === PermissionAction.ALLOW);
    if (allowed) {
      this.cache.set(cacheKey, allowed);
      return allowed;
    }
    return null;
  }

  // netloc 匹配，支持前缀通配（"*.example.com"）与去除 www.
  private matchesNetloc(host: string, netloc: string): boolean {
    if (netloc.startsWith("*.")) {
      const base = netloc.slice(2);
      return host === base || host.endsWith("." + base);
    }
    return (
      host === netloc ||
      host.replace(/^www\./, "") === netloc.replace(/^www\./, "")
    );
  }

  private async loadPermissions(): Promise<void> {
    try {
      const stored = await getLocalValue<PermissionStorage>(
        StorageKey.PERMISSION_STORAGE
      );
      if (stored) this.permissions = stored.permissions || [];
    } catch {
      // 读取失败时保持当前内存态
    }
  }

  private async savePermissions(): Promise<void> {
    try {
      const payload: PermissionStorage = { permissions: this.permissions };
      await setLocalObject({ [StorageKey.PERMISSION_STORAGE]: payload });
    } catch {
      // 写入失败时忽略
    }
  }

  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[StorageKey.PERMISSION_STORAGE]) {
        this.loadPermissions();
        this.clearCache();
      }
    });
  }

  private clearCache(): void {
    this.cache.clear();
  }
}

export const permissionService = new PermissionsManager();
