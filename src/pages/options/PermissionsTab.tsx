import React, { Fragment, useEffect, useState } from "react";
import { useFeatureGate } from "@statsig/react-bindings";
import { permissionService, PermissionItem } from "../../lib/permissions";

// 重构前变量名: R（PermissionsTab）
export function PermissionsTab() {
  const [scoped, setScoped] = useState<
    | {
        netloc: PermissionItem[];
        domain_transition: PermissionItem[];
      }
    | undefined
  >();
  const [loading, setLoading] = useState(true);
  const canSkipGate = useFeatureGate("crochet_can_skip_permissions").value;

  useEffect(() => {
    // 允许跳过权限策略（与产物一致）
    permissionService.setCanSkipPermissions(canSkipGate);
  }, [canSkipGate]);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      await permissionService.refreshFromStorage();
      const data = permissionService.getPermissionsByScope();
      setScoped(data);
    } catch {
      // 忽略读取失败
    } finally {
      setLoading(false);
    }
  }

  const revoke = async (id: string) => {
    await permissionService.revokePermission(id);
    refresh();
  };

  const formatScope = (p: PermissionItem) =>
    p.scope.type === "domain_transition"
      ? `${p.scope.fromDomain} → ${p.scope.toDomain}`
      : p.scope.netloc || "Unknown domain";

  if (loading)
    return <div className="p-6 text-text-200">Loading permissions...</div>;

  return (
    <div className="permissions-tab">
      <div className="space-y-6">
        <div className="bg-bg-100 border border-border-300 rounded-xl px-6 pt-6 pb-2 md:px-8 md:pt-8 md:pb-3">
          <h3 className="text-text-100 font-xl-bold">Your approved sites</h3>
          <p className="text-text-300 font-base mt-2 mb-6">
            You have allowed Claude to take all actions (browse, click, type) on these sites.
          </p>
          {scoped?.netloc && scoped.netloc.length > 0 ? (
            <PermissionList permissions={scoped.netloc} onRevoke={revoke} formatScope={formatScope} />
          ) : (
            <div className="text-text-400 font-base-sm pb-5">No sites have been approved yet</div>
          )}
        </div>

        {scoped?.domain_transition && scoped.domain_transition.length > 0 && (
          <div className="bg-bg-100 border border-border-300 rounded-xl px-6 pt-6 pb-2 md:px-8 md:pt-8 md:pb-3">
            <h3 className="text-text-100 font-xl-bold">Domain Transitions</h3>
            <p className="text-text-300 font-base mt-2 mb-6">Permissions for navigating between different domains.</p>
            <PermissionList permissions={scoped.domain_transition} onRevoke={revoke} formatScope={formatScope} />
          </div>
        )}
      </div>
    </div>
  );
}

// 重构前变量名: I/O（两个完全一致的列表渲染，这里合并为一个组件）
function PermissionList({
  permissions,
  onRevoke,
  formatScope,
}: {
  permissions: PermissionItem[];
  onRevoke: (id: string) => void | Promise<void>;
  formatScope: (p: PermissionItem) => string;
}) {
  return (
    <div>
      {permissions.map((p, idx) => (
        <Fragment key={p.id}>
          <div className="py-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="font-large text-text-100">{formatScope(p)}</div>
              {p.lastUsed && (
                <div className="text-xs text-text-400 mt-1">
                  Last used: {new Date(p.lastUsed).toLocaleString()}
                </div>
              )}
            </div>
            <button
              onClick={() => onRevoke(p.id)}
              className="ml-4 px-4 py-2 text-danger-000 hover:bg-danger-000/10 rounded-lg transition-all font-base"
            >
              Revoke
            </button>
          </div>
          {idx < permissions.length - 1 && (
            <div className="border-b border-border-400" />
          )}
        </Fragment>
      ))}
    </div>
  );
}
