import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../utils/apiClient";

interface UserProfile {
  account: {
    uuid: string;
    email: string;
    has_claude_max: boolean;
    has_claude_pro: boolean;
  };
  organization: {
    uuid: string;
    organization_type: string;
  };
}

export const useUserProfileQuery = (enabled: boolean = true) =>
  useQuery<UserProfile, Error>({
    queryKey: ["userProfile"],
    queryFn: () => apiClient.fetch<UserProfile>("/api/oauth/profile"),
    enabled: enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: (failureCount, error) => {
      if (error.message.includes("401") || error.message.includes("403")) {
        return false;
      }
      return failureCount < 3;
    },
  });
