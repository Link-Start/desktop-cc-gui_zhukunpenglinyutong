import { useCallback, useEffect, useMemo, useState } from "react";
import { loadSettingsStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";
import type { CodexCustomModel } from "../types";
import { STORAGE_KEYS } from "../types";
import {
  consumeVendorModelManagerRequest,
  VENDOR_MODEL_MANAGER_REQUEST_EVENT,
  type VendorModelManagerTarget,
} from "../modelManagerRequest";
import { usePluginModels } from "../hooks/usePluginModels";
import { CustomModelDialog } from "./CustomModelDialog";

function storageKeyForTarget(target: VendorModelManagerTarget): string {
  if (target === "codex") {
    return STORAGE_KEYS.CODEX_CUSTOM_MODELS;
  }
  if (target === "gemini") {
    return STORAGE_KEYS.GEMINI_CUSTOM_MODELS;
  }
  return STORAGE_KEYS.CLAUDE_CUSTOM_MODELS;
}

/**
 * 全局宿主:在当前页面直接弹出自定义模型管理弹窗,
 * 避免「添加模型」再跳进设置页造成割裂。
 * 与设置页内的 CustomModelDialog 共用 localStorage + 事件协议。
 *
 * vendor-dialog / model-manager 样式挂在 settings.css 懒加载 chunk 上；
 * 从对话页打开时必须显式 load，否则会出现无遮罩/无卡片/裸文本的样式丢失。
 */
export function VendorModelManagerDialogHost() {
  const [open, setOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [target, setTarget] = useState<VendorModelManagerTarget>("claude");
  // 仅在 open 时拉取 settings 样式，避免冷启动无意义加载整包 settings.css
  const stylesReady = useFeatureStylesReady(loadSettingsStyles, open);

  const storageKey = useMemo(() => storageKeyForTarget(target), [target]);
  const { models, updateModels } = usePluginModels(storageKey);

  const applyRequest = useCallback(() => {
    const request = consumeVendorModelManagerRequest();
    if (!request) {
      return;
    }
    setTarget(request.target);
    setAddMode(Boolean(request.addMode));
    setOpen(true);
  }, []);

  useEffect(() => {
    applyRequest();
    const handleRequest = () => applyRequest();
    window.addEventListener(VENDOR_MODEL_MANAGER_REQUEST_EVENT, handleRequest);
    return () => {
      window.removeEventListener(
        VENDOR_MODEL_MANAGER_REQUEST_EVENT,
        handleRequest,
      );
    };
  }, [applyRequest]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setAddMode(false);
  }, []);

  const handleModelsChange = useCallback(
    (next: CodexCustomModel[]) => {
      updateModels(next);
    },
    [updateModels],
  );

  return (
    <CustomModelDialog
      isOpen={open && stylesReady}
      models={models}
      onModelsChange={handleModelsChange}
      onClose={handleClose}
      initialAddMode={addMode}
      modelValidation={target === "claude" ? "shape-only" : "model-id"}
    />
  );
}
