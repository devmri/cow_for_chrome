// original var: Dc, Tc, Ac, Rc, Lc
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  ReactNode,
  Suspense,
} from "react";
import { AnalyticsBrowser } from "@segment/analytics-next";
import {
  useClientAsyncInit,
  StatsigProvider,
  StatsigContext,
} from "@statsig/react-bindings";
import type { StatsigUser } from "statsig-js";
import { getLocalValue, setLocalKey, StorageKey } from "../lib/storage"; // Assuming localSet exists
import { getEnvConfig } from "../lib/sentryService";
import { useCurrentAccount } from "./CurrentAccountProvider";
import { StatsigUserSync } from "../components/StatsigUserSync";
import { LoadingSpinner } from "../components/LoadingSpinner";

// original var: Tc
let analyticsInstance: AnalyticsBrowser | null = null;

// original var: Ac
const initializationPromise = (async () => {
  try {
    const extensionVersion = chrome.runtime.getManifest().version;
    let anonymousId = await getLocalValue(StorageKey.ANONYMOUS_ID);
    if (!anonymousId) {
      anonymousId = crypto.randomUUID();
      await setLocalKey(StorageKey.ANONYMOUS_ID, anonymousId);
    }

    const env = getEnvConfig();
    const telemetryDisabled = !!(await getLocalValue<boolean>(
      StorageKey.TELEMETRY_DISABLED,
    ));

    if (!telemetryDisabled && env.segmentWriteKey) {
      if (!analyticsInstance) {
        const instance = AnalyticsBrowser.load(
          { writeKey: env.segmentWriteKey },
          { user: { persist: false } }
        ) as AnalyticsBrowser;
        instance.setAnonymousId(anonymousId);
        instance.register({
          name: "Extension Version Plugin",
          type: "before",
          version: "1.0.0",
          load: () => Promise.resolve(),
          isLoaded: () => true,
          track: (ctx) => (
            ctx.updateEvent("properties.extension_version", extensionVersion), ctx
          ),
          page: (ctx) => (
            ctx.updateEvent("properties.extension_version", extensionVersion), ctx
          ),
        });
        analyticsInstance = instance;
      } else if (analyticsInstance) {
        (analyticsInstance as AnalyticsBrowser).setAnonymousId(anonymousId);
      }
    }

    return {
      analytics: telemetryDisabled ? null : analyticsInstance,
      statsigUser: {
        customIDs: { anonymousID: anonymousId },
        custom: { extensionVersion },
      },
    };
  } catch (error) {
    console.error("Failed to initialize analytics:", error);
    return { analytics: null, statsigUser: { customIDs: {} } };
  }
})();

interface AnalyticsContextType {
  analytics: AnalyticsBrowser | null;
  resetAnalytics: () => Promise<void>;
}

// original var: Dc
const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

// 导出 Hook，重构前变量名: u（useAnalytics）
export function useAnalytics(): AnalyticsContextType {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider");
  }
  return ctx;
}

interface AnalyticsAndStatsigProviderProps {
  children: ReactNode;
  pageName: string;
}

// original var: Rc
const AnalyticsAndStatsigProvider = ({
  children,
  pageName,
}: AnalyticsAndStatsigProviderProps) => {
  const { analytics, statsigUser: initialStatsigUser } = React.use(
    initializationPromise
  );
  const [telemetryDisabled, setTelemetryDisabled] = useState(false);
  const {
    userProfile,
    isAuthenticated,
    isLoading: isAccountLoading,
  } = useCurrentAccount();
  const env = getEnvConfig();

  useEffect(() => {
    let mounted = true;

    const readTelemetryPreference = async () => {
      try {
        const value = await getLocalValue<boolean>(
          StorageKey.TELEMETRY_DISABLED,
        );
        if (mounted) setTelemetryDisabled(!!value);
      } catch {
        if (mounted) setTelemetryDisabled(false);
      }
    };

    readTelemetryPreference();

    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
      return () => {
        mounted = false;
      };
    }

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local") return;
      if (StorageKey.TELEMETRY_DISABLED in changes) {
        setTelemetryDisabled(
          !!changes[StorageKey.TELEMETRY_DISABLED].newValue,
        );
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (telemetryDisabled && analytics) {
      analytics.reset();
    }
  }, [telemetryDisabled, analytics]);

  useEffect(() => {
    if (telemetryDisabled) return;
    if (isAuthenticated && userProfile && analytics) {
      analytics.identify(userProfile.account.uuid, {
        email: userProfile.account.email,
        organizationID: userProfile.organization.uuid,
        organizationUUID: userProfile.organization.uuid,
        applicationSlug: "claude-browser-use",
        isMax: userProfile.account.has_claude_max,
        isPro: userProfile.account.has_claude_pro,
        orgType: userProfile.organization.organization_type,
      });
    }
  }, [isAuthenticated, userProfile, analytics]);

  const statsigUser = useMemo(
    () =>
      isAuthenticated && userProfile
        ? {
            userID: userProfile.account.uuid,
            customIDs: {
              ...initialStatsigUser.customIDs,
              organizationID: userProfile.organization.uuid,
              organizationUUID: userProfile.organization.uuid,
              applicationSlug: "claude-browser-use",
            },
            custom: {
              ...initialStatsigUser.custom,
              isMax: userProfile.account.has_claude_max,
              isPro: userProfile.account.has_claude_pro,
              orgType: userProfile.organization.organization_type,
            },
            privateAttributes: { email: userProfile.account.email },
          }
        : initialStatsigUser,
    [isAuthenticated, userProfile, initialStatsigUser]
  );

  const statsigOptions = useMemo(
    () => ({
      environment: { tier: "production" },
    }),
    [env.environment]
  );

  useEffect(() => {
    if (telemetryDisabled) return;
    analytics?.page("Extension", pageName);
  }, [analytics, pageName, telemetryDisabled]);

  const effectiveAnalytics = telemetryDisabled ? null : analytics;
  const analyticsContextValue = useMemo<AnalyticsContextType>(
    () => ({
      analytics: effectiveAnalytics,
      resetAnalytics: async () => {
        try {
          if (effectiveAnalytics) {
            effectiveAnalytics.reset();
            const anonymousId = await getLocalValue(StorageKey.ANONYMOUS_ID);
            if (anonymousId) {
              effectiveAnalytics.setAnonymousId(anonymousId);
            }
          }
        } catch (error) {
          console.error("Failed to reset analytics:", error);
        }
      },
    }),
    [effectiveAnalytics, telemetryDisabled]
  );

  return (
    <StatsigGate
      analyticsContextValue={analyticsContextValue}
      statsigUser={statsigUser}
      statsigOptions={statsigOptions}
      statsigClientApiKey={env.statsigClientApiKey}
      isAccountLoading={isAccountLoading}
      anonymousId={statsigUser.customIDs?.anonymousID}
      telemetryDisabled={telemetryDisabled}
    >
      {children}
    </StatsigGate>
  );
};

type StatsigUserShape = {
  userID?: string | number;
  customIDs?: Record<string, string | undefined>;
  custom?: Record<string, unknown>;
  privateAttributes?: Record<string, unknown>;
};

function sanitizeStatsigUser(user: StatsigUserShape): StatsigUser {
  const customIDs = user.customIDs
    ? Object.entries(user.customIDs).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          if (typeof value === "string") acc[key] = value;
          return acc;
        },
        {},
      )
    : undefined;

  const userID =
    user.userID !== undefined ? String(user.userID) : undefined;

  const custom = user.custom
    ? Object.entries(user.custom).reduce<
        Record<string, string | number | boolean | string[] | undefined>
      >((acc, [key, value]) => {
        if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
          acc[key] = value as string[];
        } else if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          acc[key] = value;
        } else if (value !== undefined && value !== null) {
          acc[key] = String(value);
        }
        return acc;
      }, {})
    : undefined;

  const privateAttributes = user.privateAttributes
    ? Object.entries(user.privateAttributes).reduce<
        Record<string, string | number | boolean | string[] | undefined>
      >((acc, [key, value]) => {
        if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
          acc[key] = value as string[];
        } else if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          acc[key] = value;
        } else if (value !== undefined && value !== null) {
          acc[key] = String(value);
        }
        return acc;
      }, {})
    : undefined;

  return {
    userID,
    customIDs,
    custom,
    privateAttributes,
  };
}

interface StatsigGateProps {
  analyticsContextValue: AnalyticsContextType;
  statsigUser: StatsigUserShape;
  statsigOptions: Record<string, unknown>;
  statsigClientApiKey: string;
  isAccountLoading: boolean;
  anonymousId?: string;
  telemetryDisabled: boolean;
  children: ReactNode;
}

function StatsigGate({
  analyticsContextValue,
  statsigUser,
  statsigOptions,
  statsigClientApiKey,
  isAccountLoading,
  anonymousId,
  telemetryDisabled,
  children,
}: StatsigGateProps) {
  const [isMockStatsig, setMockStatsig] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadFlag = async () => {
      try {
        const flag = await getLocalValue<boolean>(
          StorageKey.MOCK_STATSIG_ENABLED,
        );
        console.info("[StatsigGate] mock flag loaded", flag);
        if (mounted) setMockStatsig(!!flag);
      } catch {
        console.info("[StatsigGate] mock flag read failed, defaulting to false");
        if (mounted) setMockStatsig(false);
      }
    };

    loadFlag();

    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
      return () => {
        mounted = false;
      };
    }

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local") return;
      if (StorageKey.MOCK_STATSIG_ENABLED in changes) {
        console.info(
          "[StatsigGate] mock flag updated",
          changes[StorageKey.MOCK_STATSIG_ENABLED],
        );
        setMockStatsig(!!changes[StorageKey.MOCK_STATSIG_ENABLED].newValue);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  const shouldUseMock = telemetryDisabled || !!isMockStatsig;

  if (!telemetryDisabled && isMockStatsig === null) {
    console.info("[StatsigGate] awaiting mock flag resolution");
    return <LoadingSpinner />;
  }

  console.info("[StatsigGate] rendering", {
    isMockStatsig: shouldUseMock,
    isAccountLoading,
    telemetryDisabled,
  });

  return (
    <AnalyticsContext.Provider value={analyticsContextValue}>
      {shouldUseMock ? (
        <MockStatsigProvider statsigUser={statsigUser}>{children}</MockStatsigProvider>
      ) : (
        <RealStatsigBridge
          statsigClientApiKey={statsigClientApiKey}
          statsigUser={statsigUser}
          statsigOptions={statsigOptions}
          isAccountLoading={isAccountLoading}
          anonymousId={anonymousId}
        >
          {children}
        </RealStatsigBridge>
      )}
    </AnalyticsContext.Provider>
  );
}

interface RealStatsigBridgeProps {
  statsigClientApiKey: string;
  statsigUser: StatsigUserShape;
  statsigOptions: Record<string, unknown>;
  isAccountLoading: boolean;
  anonymousId?: string;
  children: ReactNode;
}

function RealStatsigBridge({
  statsigClientApiKey,
  statsigUser,
  statsigOptions,
  isAccountLoading,
  anonymousId,
  children,
}: RealStatsigBridgeProps) {
  const sanitizedUser = useMemo(() => sanitizeStatsigUser(statsigUser), [statsigUser]);
  const { client: statsigClient, isLoading: isStatsigLoading } =
    useClientAsyncInit(
      statsigClientApiKey,
      sanitizedUser as any,
      statsigOptions as any,
    );

  console.info("[StatsigGate] using real Statsig", {
    isStatsigLoading,
    isAccountLoading,
  });

  if (isStatsigLoading || isAccountLoading) {
    return <LoadingSpinner />;
  }

  return (
    <StatsigProvider client={statsigClient}>
      <StatsigUserSync anonymousId={anonymousId} />
      {children}
    </StatsigProvider>
  );
}

interface MockStatsigProviderProps {
  statsigUser: StatsigUserShape;
  children: ReactNode;
}

function MockStatsigProvider({
  statsigUser,
  children,
}: MockStatsigProviderProps) {
  const clientRef = useRef<MockStatsigClient | null>(null);

  console.info("[StatsigGate] using mock Statsig", statsigUser);

  if (!clientRef.current) {
    clientRef.current = new MockStatsigClient(
      MOCK_FEATURE_GATES,
      MOCK_DYNAMIC_CONFIGS,
      statsigUser,
    );
  } else {
    clientRef.current.updateUserSync(statsigUser);
  }

  const contextValue = useMemo(
    () => ({
      renderVersion: 0,
      client: clientRef.current! as unknown,
    }),
    [],
  );

  return (
    <StatsigContext.Provider value={contextValue as any}>
      {children}
    </StatsigContext.Provider>
  );
}

type GateMap = Record<string, boolean>;
type ConfigMap = Record<string, Record<string, any>>;

class MockStatsigClient {
  private listeners = new Set<() => void>();
  private user: StatsigUserShape;
  readonly loadingStatus = "Ready";

  constructor(
    private gates: GateMap,
    private configs: ConfigMap,
    initialUser: StatsigUserShape = {},
  ) {
    const sanitized = sanitizeStatsigUser(initialUser);
    this.user = {
      userID: sanitized.userID ?? "mock-user",
      customIDs: sanitized.customIDs ?? {},
      custom: sanitized.custom ?? {},
      privateAttributes: sanitized.privateAttributes,
    };
  }

  $on(event: string, handler: () => void) {
    if (event === "values_updated") {
      this.listeners.add(handler);
    }
  }

  off(event: string, handler: () => void) {
    if (event === "values_updated") {
      this.listeners.delete(handler);
    }
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }

  getContext() {
    return { user: this.user };
  }

  updateUserAsync(user: StatsigUserShape): Promise<void> {
    this.updateUserSync(user);
    return Promise.resolve();
  }

  updateUserSync(user: StatsigUserShape): void {
    const sanitized = sanitizeStatsigUser(user);
    this.user = {
      ...this.user,
      userID: sanitized.userID ?? this.user.userID,
      customIDs: {
        ...this.user.customIDs,
        ...(sanitized.customIDs ?? {}),
      },
      custom: {
        ...this.user.custom,
        ...(sanitized.custom ?? {}),
      },
      privateAttributes:
        sanitized.privateAttributes ?? this.user.privateAttributes,
    };
  }

  checkGate(name: string): boolean {
    return this.getFeatureGate(name).value;
  }

  getFeatureGate(name: string) {
    return {
      name,
      value: this.gates[name] ?? true,
      rule_id: "mock_rule",
      secondary_exposures: [] as Array<Record<string, string>>,
      evaluation_details: {},
    };
  }

  getDynamicConfig(name: string) {
    return new MockDynamicConfig(name, this.configs[name] ?? {});
  }

  getExperiment(name: string) {
    return this.getDynamicConfig(name);
  }

  getLayer(name: string) {
    return new MockLayer(name, this.configs[name] ?? {});
  }

  logEvent(): void {
    // no-op in mock mode
  }
}

class MockDynamicConfig {
  readonly name: string;
  readonly value: Record<string, any>;
  readonly ruleID = "mock_rule";
  readonly groupName = "mock_group";

  constructor(name: string, value: Record<string, any>) {
    this.name = name;
    this.value = value;
  }

  getValue<T>(key: string, defaultValue: T): T {
    return (this.value[key] ?? defaultValue) as T;
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    if (key in this.value) return this.value[key] as T;
    return defaultValue;
  }

  toJSON() {
    return this.value;
  }
}

class MockLayer extends MockDynamicConfig {
  getValue<T>(key: string, defaultValue: T): T {
    return super.getValue(key, defaultValue);
  }
}

const MOCK_FEATURE_GATES: GateMap = {
  chrome_scheduled_tasks: true,
  chrome_extension_show_user_email: true,
  crochet_default_debug_mode: true,
  chrome_ext_allow_api_key: true,
  chrome_ext_edit_system_prompt: true,
  crochet_can_skip_permissions: true,
  crochet_browse_shortcuts: true,
  chrome_ext_domain_transition_prompts: true,
  crochet_can_submit_feedback: true,
  crochet_can_see_browser_indicator: true,
  crochet_upsell_ant_build: true,
  chrome_ext_trace_headers: true,
  cascade_nebula: true,
};

const MOCK_DYNAMIC_CONFIGS: ConfigMap = {
  chrome_ext_models: {
    options: [
      "claude-sonnet-4-20250514",
      "claude-3-5-sonnet-latest",
      "claude-3-haiku-20240307",
    ],
    defaultModel: "claude-sonnet-4-20250514",
  },
  chrome_ext_version_info: {
    min_supported_version: null,
  },
  chrome_ext_system_prompt: {
    systemPrompt:
      "You are Cow for Chrome (mock mode). Respond concisely, follow the user's instructions, and mention if additional permissions are required. Current datetime: {{currentDateTime}}.",
  },
  chrome_ext_skip_perms_system_prompt: {
    skipPermissionsSystemPrompt:
      "You are operating in skip-permissions mode (mock). Clearly explain any assumptions and highlight actions that would normally require permissions. Current datetime: {{currentDateTime}}.",
  },
  chrome_ext_models_default_prompt: {
    systemPrompt:
      "Default mock system prompt placeholder. Current datetime: {{currentDateTime}}.",
  },
  chrome_ext_skip_perms_models_default_prompt: {
    skipPermissionsSystemPrompt:
      "Default skip-permissions mock prompt. Current datetime: {{currentDateTime}}.",
  },
  chrome_ext_models_beta: {
    options: ["claude-3-opus-20240229"],
  },
  chrome_ext_models_restricted: {
    options: [],
  },
  chrome_ext_models_rollout: {
    enabled: true,
  },
  chrome_ext_version_rollout: {
    rollout: 1,
  },
  crochet_chips: {},
};

// original var: Lc
export const AnalyticsProvider = ({
  children,
  pageName,
}: AnalyticsAndStatsigProviderProps) => (
  <Suspense fallback={<LoadingSpinner />}>
    <AnalyticsAndStatsigProvider pageName={pageName}>
      {children}
    </AnalyticsAndStatsigProvider>
  </Suspense>
);
