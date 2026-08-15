/**
 * T2.6 / 三刀：AppShell 根只组装 Host 子树。
 * 业务 hooks 在 hosts/*；zone providers + view 在 Host 树内装配。
 */
export { AppShellHostTree as useAppShellRootComposition } from "../hosts/AppShellHostTree";
