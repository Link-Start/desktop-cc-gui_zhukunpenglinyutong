import { AppShellHostTree } from "../hosts/AppShellHostTree";

/**
 * AppShell composition 入口。
 * 业务 hooks 在独立 Host 子树；本文件只挂载 Host 树。
 */
export function AppShell() {
  return <AppShellHostTree />;
}
