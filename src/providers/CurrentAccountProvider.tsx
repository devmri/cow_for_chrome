import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from "react";
import { getLocalValue, StorageKey } from "../lib/storage";
import { useUserProfileQuery } from "../hooks/useUserProfileQuery";

interface CurrentAccountContextType {
  userProfile: any | null; // 实际应使用 UserProfile 类型
  isLoading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
}

const CurrentAccountContext = createContext<CurrentAccountContextType | null>(
  null
);

interface CurrentAccountProviderProps {
  children: ReactNode;
}

export const CurrentAccountProvider = ({
  children,
}: CurrentAccountProviderProps) => {
  const [isTokenPresent, setTokenPresent] = useState(false);
  const [isInitialCheckLoading, setInitialCheckLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await getLocalValue(StorageKey.ACCESS_TOKEN);
        setTokenPresent(!!token);
      } catch (error) {
        setTokenPresent(false);
      } finally {
        setInitialCheckLoading(false);
      }
    };

    checkToken();

    const handleStorageChange = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (StorageKey.ACCESS_TOKEN in changes) {
        const newAccessToken = changes[StorageKey.ACCESS_TOKEN].newValue;
        setTokenPresent(!!newAccessToken);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const {
    data: userProfile,
    isLoading: isQueryLoading,
    error,
  } = useUserProfileQuery(isTokenPresent);
  const contextValue: CurrentAccountContextType = {
    userProfile: userProfile ?? null,
    isLoading: isInitialCheckLoading || (isTokenPresent && isQueryLoading),
    error,
    isAuthenticated: isTokenPresent && !!userProfile,
  };

  return (
    <CurrentAccountContext.Provider value={contextValue}>
      {children}
    </CurrentAccountContext.Provider>
  );
};

// original var: Ic
export const useCurrentAccount = () => {
  const context = useContext(CurrentAccountContext);
  if (!context) {
    throw new Error(
      "useCurrentAccount must be used within a CurrentAccountProvider"
    );
  }
  return context;
};
