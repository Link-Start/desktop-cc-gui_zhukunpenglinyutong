export const CODEX_DISK_PROVIDER_PROFILE_ID = "__disk__";
export const CODEX_DISK_PROVIDER_PROFILE_NAME = "codex-tui/default-config";
export const CLAUDE_LOCAL_PROVIDER_PROFILE_ID = "__local_settings_json__";
export const CLAUDE_LOCAL_PROVIDER_PROFILE_NAME = "Local settings.json";
export const KIMI_LOCAL_PROVIDER_PROFILE_ID = "__local_config_toml__";
export const KIMI_LOCAL_PROVIDER_PROFILE_NAME = "Local config.toml";
export const GROK_LOCAL_PROVIDER_PROFILE_ID = "__local_config_toml__";
export const GROK_LOCAL_PROVIDER_PROFILE_NAME = "Local config.toml";
export const OPENCODE_LOCAL_PROVIDER_PROFILE_ID = "__local_opencode_json__";
export const OPENCODE_LOCAL_PROVIDER_PROFILE_NAME = "Local opencode.json";

export type EngineProviderProfileOption = {
  id: string;
  name: string;
  source: "disk" | "managed";
  availability?: "available" | "unavailable";
};

export type EngineProviderProfileSelection = {
  providerProfileId?: string | null;
  providerProfile?: EngineProviderProfileOption | null;
};

export type CodexProviderProfileOption = EngineProviderProfileOption;
export type CodexProviderProfileSelection = EngineProviderProfileSelection;
