// promptDistill — 日本語 UI 文字列
const promptDistill = {
  promptDistill: {
    menuSaveAsPrompt: "選択範囲からコマンドを生成",
    menuSaveThreadAsPrompt: "スレッド全体からコマンドを生成",
    dialogTitle: "コマンドを生成",
    dialogDescription:
      "会話内容を再利用可能なスラッシュコマンドとして抽出します。保存するとこのワークスペースのコマンドディレクトリに書き込まれ、以後は入力欄で / と入力して呼び出せます。テンプレート内の $ARGUMENTS は呼び出し時に入力した引数で置き換えられます。",
    nameLabel: "コマンド名",
    namePlaceholder: "例: review-checklist",
    contentLabel: "コマンドテンプレート",
    argumentsHint: "/コマンド 呼び出し時の引数を挿入したい位置に $ARGUMENTS を使用してください。",
    distilling: "コマンドを生成中…",
    save: "保存",
    saving: "保存中…",
    cancel: "キャンセル",
    nameInvalid:
      "小文字の英字・数字・ハイフン・アンダースコアのみ使用でき、先頭は英字または数字にしてください。",
    failedTimeout: "コマンド生成がタイムアウトしました（{{seconds}} 秒）",
    failedEmpty: "エンジンが空のコマンドテンプレートを返しました",
    failedGeneric: "コマンド生成に失敗しました",
    savedTitle: "コマンドを保存しました",
    savedMessage: "/{{name}} として保存されました。入力欄で / と入力して呼び出せます。",
  },
};

export default promptDistill;
