import type { CSSProperties } from "react";
import type { CommitMessageEngine } from "../../../services/tauri";
import { EngineIcon } from "../../engine/components/EngineIcon";

type CommitMessageEngineIconProps = {
  engine: CommitMessageEngine;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * 生成按钮上的引擎图标。统一复用 EngineIcon，避免与 picker 列表里的
 * 引擎图标（路径 glyph / 官方 svg）分裂成两套事实源。
 */
export function CommitMessageEngineIcon({
  engine,
  size = 14,
  className,
  style,
}: CommitMessageEngineIconProps) {
  return (
    <EngineIcon engine={engine} size={size} className={className} style={style} />
  );
}
