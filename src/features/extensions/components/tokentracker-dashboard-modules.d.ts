// Vendored TokenTracker dashboard 的 JSX 模块声明。vendored tree 是无类型的
// .jsx，这里只声明 extensions host 实际挂载的入口模块（specifier 与 import
// 写法逐字一致），避免把 any 扩散到其余 70+ vendored 文件。
declare module "@/features/extensions/tokentracker-dashboard/pages/DashboardPage.jsx" {
  import type { ComponentType } from "react";

  export const DashboardPage: ComponentType<{
    baseUrl?: string;
    onMainContentVisible?: () => void;
  }>;
}

declare module "@/features/extensions/tokentracker-dashboard/pages/SkillsPage.jsx" {
  import type { ComponentType } from "react";

  export const SkillsPage: ComponentType;
}

declare module "@/features/extensions/tokentracker-dashboard/ui/foundation/LocaleProvider.jsx" {
  import type { ComponentType, ReactNode } from "react";

  export const LocaleProvider: ComponentType<{ children?: ReactNode }>;
}

declare module "@/features/extensions/tokentracker-dashboard/ui/foundation/CurrencyProvider.jsx" {
  import type { ComponentType, ReactNode } from "react";

  export const CurrencyProvider: ComponentType<{ children?: ReactNode }>;
}

declare module "@/features/extensions/tokentracker-dashboard/ui/foundation/TokenFormatProvider.jsx" {
  import type { ComponentType, ReactNode } from "react";

  export const TokenFormatProvider: ComponentType<{ children?: ReactNode }>;
}

declare module "@/features/extensions/tokentracker-dashboard/ui/foundation/ThemeProvider.jsx" {
  import type { ComponentType, ReactNode } from "react";

  export const ThemeProvider: ComponentType<{ children?: ReactNode }>;
}

declare module "@/features/extensions/tokentracker-dashboard/ui/components/Toast.jsx" {
  import type { ComponentType, ReactNode } from "react";

  export const ToastProvider: ComponentType<{ children?: ReactNode }>;
}

declare module "@/features/extensions/tokentracker-dashboard/ui/components/Button.jsx" {
  import type { ComponentType, ReactNode } from "react";

  export const Button: ComponentType<{
    children?: ReactNode;
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "md" | "lg";
    type?: "button" | "submit" | "reset";
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }>;
}

declare module "@/features/extensions/tokentracker-dashboard/ui/components/Input.jsx" {
  import type { ComponentType, ChangeEvent, KeyboardEvent } from "react";

  export const Input: ComponentType<{
    id?: string;
    value?: string;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
    label?: string;
    error?: string;
    className?: string;
    "aria-label"?: string;
  }>;
}

declare module "@/features/extensions/tokentracker-dashboard/ui/dashboard/components/ProviderIcon.jsx" {
  import type { ComponentType } from "react";

  export const ProviderIcon: ComponentType<{
    provider?: string;
    size?: number;
    color?: string;
    className?: string;
  }>;
}
