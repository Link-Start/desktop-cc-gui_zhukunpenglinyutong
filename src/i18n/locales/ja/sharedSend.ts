// sharedSend — 日本語 UI 文字列（Wave 4 / Change B §14.5 UI ステートマシン）
const sharedSend = {
  sharedSend: {
    preparingContext: "Shared Session のコンテキストを準備しています…",
    degradedTitle: "コンテキスト縮退",
    degradedHint: "コンテキスト投影に omissions があります。確認なしでは送信されません。",
    degradedConfirm: "送信を続ける",
    degradedDetails: "詳細を表示",
    degradedMode: "転送方式：{{mode}}",
    degradedTokenEstimate:
      "推定コンテキスト量：{{source}} → {{package}} トークン",
    unknownDetail: "未認識のプロトコル値：{{value}}",
    modeNativeDelta: "ネイティブ差分コンテキスト",
    modeNativeHistoryImport: "ネイティブ履歴のインポート",
    modeNativeHistoryClone: "ネイティブセッションの複製",
    modePortableTranscript: "互換テキスト転記",
    modeCheckpoint: "圧縮チェックポイント",
    dispositionRetrievable: "必要時に取得可能",
    dispositionNotRetrievable: "取得不可",
    omissionImageHistory:
      "転送先の履歴は画像に対応していません。",
    omissionAssistantOutcome:
      "アシスタントのターンは「{{outcome}}」で終了したため、成功応答として再生されません。",
    omissionPrivateReasoning:
      "プロバイダー固有の非公開思考は転送できません。",
    omissionAssistantArtifact:
      "アシスタント成果物は参照としてのみ保持され、本文には挿入されません。",
    omissionPrivateBlock:
      "未対応のアシスタント非公開ブロックを省略しました。",
    omissionToolHistory:
      "転送先がツール履歴に対応していないため、ツール呼び出しと結果をまとめて省略しました。",
    omissionHistoricalControl:
      "過去の制御操作は参照専用で、再実行されません。",
    omissionDeterministicFold:
      "コンテキスト上限に収めるため、長い内容を折りたたみました。",
    omissionCheckpointBudget:
      "コンテキスト上限に収めるため、最も古い完全なターンを省略しました。",
    omissionDestinationOwned:
      "転送先のネイティブ履歴に既にある内容は重複させません。",
    omissionUnknown: "未認識の省略項目（{{category}}）：{{reason}}",
    outcomeCompleted: "完了",
    outcomeFailed: "失敗",
    outcomeCancelled: "キャンセル済み",
    outcomeReplaced: "置換済み",
    outcomeUnknown: "不明",
    awaitingAcceptance: "送信済みです。CLI の処理開始を確認しています…",
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
    selectionPersistFailedTitle: "選択した送信先を保存できませんでした",
    selectionPersistFailedMessage:
      "現在の選択はメモリ上で保持されていますが、再起動後は以前の送信先が使われる場合があります：{{reason}}",
    recoveryStop: "Stop delivery",
    recoveryStopHint: "Ask the runtime to stop the in-flight attempt. The session stays locked until you settle or rebuild.",
    recoveryStopAndRebuild: "Stop and rebuild",
    recoveryStopAndRebuildHint: "Stop the runtime-owned attempt when needed, then archive the binding and prepare a new connection.",
    recoveryAbandon: "Abandon this turn",
    recoveryAbandonHint: "Durably cancel the unresolved turn and unlock the session. Does not delete the conversation.",
    recoveryAbandonConfirm: "Abandon this unresolved turn and unlock the shared session? The turn will be marked cancelled. The conversation itself is kept.",
    recoveryStopNoAttempt: "No in-flight attempt to stop. Use check status, rebuild, or abandon instead.",
    recoveryHintAfterStop: "Delivery stop was requested. Check status, stop and rebuild, or abandon this turn to finish unlocking.",
    recoveryErrorActive: "The runtime still owns this attempt. Stop delivery first, then rebuild—or abandon this turn.",
    recoveryErrorActiveRequiresStop: "The runtime still owns this attempt. Stop delivery before abandoning, or confirm force-stop when abandoning.",
    recoveryErrorAmbiguous: "Multiple unresolved owners were found. Recovery cannot safely continue automatically; contact support with session details if this persists.",
    recoveryErrorOwnerMissing: "No matching unresolved attempt was found. Try check status; the session may already be clear.",
    recoveryErrorEmptyContextHandoff:
      "共有コンテキストを再構築できませんでした。停止して再構築するか、別のターゲットに切り替えて再送してください。",
    recoveryTechDetail: "technical detail available",
    targetUnavailableHint: "Switch to another target in the picker, then send again.",
    cancel: "キャンセル",
  },
};

export default sharedSend;
