import { listen } from "@tauri-apps/api/event";

/**
 * `curated-skills-changed` 事件订阅：Rust 在 `set_curated_skill_enabled`
 * 成功落盘后 emit。放在 feature 内部而非 services/events.ts——后者已处
 * large-files gate 阈值上限，事件域归属本 feature 内聚。
 */
export function subscribeCuratedSkillsChanged(
  listener: () => void,
): () => void {
  let disposed = false;
  let unlisten: (() => void) | null = null;

  void listen("curated-skills-changed", () => {
    listener();
  }).then((fn) => {
    if (disposed) {
      fn();
      return;
    }
    unlisten = fn;
  });

  return () => {
    disposed = true;
    unlisten?.();
  };
}
