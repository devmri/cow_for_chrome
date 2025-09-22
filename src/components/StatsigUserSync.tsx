// original var: Mc
import { useEffect } from "react";
import { useStatsigUser } from "@statsig/react-bindings";
import type { StatsigUser } from "statsig-js";
import { useCurrentAccount } from "../providers/CurrentAccountProvider";

interface StatsigUserSyncProps {
  anonymousId?: string;
}

// 原组件名: Mc
export const StatsigUserSync = ({ anonymousId }: StatsigUserSyncProps) => {
  const { userProfile, isAuthenticated } = useCurrentAccount();
  const { updateUserAsync, user: statsigUser } = useStatsigUser() as {
    updateUserAsync: (user: Partial<StatsigUser>) => Promise<unknown>;
    user: StatsigUser;
  };

  useEffect(() => {
    if (isAuthenticated && userProfile) {
      if (userProfile.account.uuid !== statsigUser.userID) {
        const newUser: Partial<StatsigUser> = {
          userID: userProfile.account.uuid,
          customIDs: {
            organizationID: userProfile.organization.uuid,
            organizationUUID: userProfile.organization.uuid,
            applicationSlug: "claude-browser-use",
          },
          custom: {
            isMax: userProfile.account.has_claude_max,
            isPro: userProfile.account.has_claude_pro,
            orgType: userProfile.organization.organization_type,
            extensionVersion: chrome.runtime.getManifest().version,
          },
          privateAttributes: { email: userProfile.account.email },
        };
        if (anonymousId && newUser.customIDs) {
          (newUser.customIDs as Record<string, string>).anonymousID = anonymousId;
        }
        void updateUserAsync(newUser);
      }
    } else if (!isAuthenticated && statsigUser.userID) {
      const anonymousCustomIDs = anonymousId
        ? { anonymousID: anonymousId }
        : undefined;
      const anonymousUser: Partial<StatsigUser> = {
        customIDs: anonymousCustomIDs,
        custom: { extensionVersion: chrome.runtime.getManifest().version },
      };
      void updateUserAsync(anonymousUser);
    }
  }, [
    isAuthenticated,
    userProfile,
    anonymousId,
    statsigUser,
    updateUserAsync,
  ]);

  return null;
};
