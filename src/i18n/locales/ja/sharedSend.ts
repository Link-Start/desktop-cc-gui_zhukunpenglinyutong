// sharedSend — 日本語 UI 文字列（Wave 4 / Change B §14.5 UI ステートマシン）
const sharedSend = {
  sharedSend: {
    preparingContext: "Shared Session のコンテキストを準備しています…",
    degradedTitle: "コンテキスト縮退",
    degradedHint: "コンテキスト投影に omissions があります。確認なしでは送信されません。",
    degradedConfirm: "それでも送信",
    awaitingAcceptance: "配信中…ランタイムの受領確認を待っています。",
    cancelUnsupported:
      "この Adapter は保留中の配信をキャンセルできません。ランタイムの判定をお待ちください。",
    cancelPending: "キャンセル結果を確認しています…",
    settling: "結果を保存しています…",
    recoveryTitle: "復旧が必要です",
    recoveryHint:
      "前回の送信は受領結果が不明確なため、このセッションはロックされています。Probe で定性するか、Binding を明示的に再構築してください。",
    recoveryProbe: "Probe",
    recoveryProbing: "Probe 中…",
    recoveryRebuild: "Binding を再構築",
    recoveryProbeHeld:
      "Probe が受理済み・未コミットの Attempt を検出しました。順序保護のためロックを維持します。",
    recoveryProbeCleared: "Probe で保留中の Attempt は見つかりませんでした。ロックを解除しました。",
    targetUnavailable: "選択中の Target は利用できません。",
    targetUnavailableReason: "選択中の Target は利用できません: {{reason}}",
    cancel: "キャンセル",
  },
};

export default sharedSend;
