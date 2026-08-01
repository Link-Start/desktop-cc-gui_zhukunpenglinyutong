#!/usr/bin/env python3
"""一次性脚本: 把 jetbrains-cc-gui 参考文案移植到 desktop 10 个 locale 的 settings.vendor.*
- zh/en: 重建 ccSwitchImport 块(保留 desktop 既有键值) + 插入 importMenu
- 其余 8 语言(无 ccSwitchImport 块): 插入 ccSwitchImport + importMenu
- 所有 locale: localProvider* 改值+新增 12 键、dialog 改 editTitle+删 presetGroup+新增 9 键、
  presets 重建 13 键、codexDialog 改 editTitle+新增 7 键、deleteConfirm.message 改值
参考缺翻译(English 兜底或缺失)的键使用 MANUAL 表内的翻译。
"""
import json
import re
import sys

DESKTOP = "/Users/zhukunpeng/Desktop/CC GUI 项目/desktop-cc-gui"
REF = "/Users/zhukunpeng/Desktop/CC GUI 项目/jetbrains-cc-gui"
LOCALES = ["zh", "en", "zh-TW", "ja", "ko", "es", "fr", "pt-BR", "ru", "hi"]

# ---------------------------------------------------------------- MANUAL ----
# scoped key: "<block>.<key>" / "cc.<key>" / "vendor.<key>" / "importMenu.<key>"
CC6 = {
    "zh-TW": {
        "cc.selectAll": "全選",
        "cc.refresh": "重新整理",
        "cc.emptySource": "未偵測到 CC Switch 配置（~/.cc-switch）",
        "cc.emptyCategory": "此類型下沒有可匯入的配置",
        "cc.successBanner": "已匯入 {{count}} 個供應商",
        "cc.failureBanner": "{{count}} 個匯入失敗：{{names}}",
    },
    "ja": {
        "cc.selectAll": "すべて選択",
        "cc.refresh": "更新",
        "cc.emptySource": "CC Switch 設定が見つかりません（~/.cc-switch）",
        "cc.emptyCategory": "この種類にはインポート可能な設定がありません",
        "cc.successBanner": "{{count}} 件のプロバイダーをインポートしました",
        "cc.failureBanner": "{{count}} 件のインポートに失敗しました：{{names}}",
    },
    "ko": {
        "cc.selectAll": "전체 선택",
        "cc.refresh": "새로 고침",
        "cc.emptySource": "CC Switch 구성을 찾을 수 없습니다 (~/.cc-switch)",
        "cc.emptyCategory": "이 유형에서 가져올 수 있는 구성이 없습니다",
        "cc.successBanner": "공급자 {{count}}개를 가져왔습니다",
        "cc.failureBanner": "{{count}}개 가져오기 실패: {{names}}",
    },
    "es": {
        "cc.selectAll": "Seleccionar todo",
        "cc.refresh": "Actualizar",
        "cc.emptySource": "No se detectó configuración de CC Switch (~/.cc-switch)",
        "cc.emptyCategory": "No hay configuraciones importables en este tipo",
        "cc.successBanner": "Se importaron {{count}} proveedores",
        "cc.failureBanner": "{{count}} importaciones fallidas: {{names}}",
    },
    "fr": {
        "cc.selectAll": "Tout sélectionner",
        "cc.refresh": "Actualiser",
        "cc.emptySource": "Aucune configuration CC Switch détectée (~/.cc-switch)",
        "cc.emptyCategory": "Aucune configuration importable dans ce type",
        "cc.successBanner": "{{count}} fournisseurs importés",
        "cc.failureBanner": "{{count}} importations ont échoué : {{names}}",
    },
    "pt-BR": {
        "cc.selectAll": "Selecionar tudo",
        "cc.refresh": "Atualizar",
        "cc.emptySource": "Nenhuma configuração do CC Switch detectada (~/.cc-switch)",
        "cc.emptyCategory": "Não há configurações importáveis neste tipo",
        "cc.successBanner": "{{count}} provedores importados",
        "cc.failureBanner": "{{count}} importações falharam: {{names}}",
    },
    "ru": {
        "cc.selectAll": "Выбрать все",
        "cc.refresh": "Обновить",
        "cc.emptySource": "Конфигурация CC Switch не обнаружена (~/.cc-switch)",
        "cc.emptyCategory": "Нет конфигураций для импорта этого типа",
        "cc.successBanner": "Импортировано поставщиков: {{count}}",
        "cc.failureBanner": "Не удалось импортировать {{count}}: {{names}}",
    },
    "hi": {
        "cc.selectAll": "सभी चुनें",
        "cc.refresh": "रीफ्रेश",
        "cc.emptySource": "CC Switch कॉन्फ़िगरेशन नहीं मिला (~/.cc-switch)",
        "cc.emptyCategory": "इस प्रकार में आयात योग्य कोई कॉन्फ़िगरेशन नहीं है",
        "cc.successBanner": "{{count}} प्रदाता आयात किए गए",
        "cc.failureBanner": "{{count}} आयात विफल: {{names}}",
    },
}

GOT_IT = {
    "zh-TW": "知道了", "ja": "了解", "ko": "알겠습니다", "es": "Entendido",
    "fr": "Compris", "pt-BR": "Entendi", "ru": "Понятно", "hi": "समझ गया",
}

WHAT_IS_THIS = {
    "zh-TW": "這是什麼？", "ja": "これは何ですか？", "ko": "이것은 무엇인가요?",
    "es": "¿Qué es esto?", "fr": "Qu'est-ce que c'est ?", "pt-BR": "O que é isso?",
    "ru": "Что это?", "hi": "यह क्या है?",
}

DIALOG_SECTIONS = {
    "zh-TW": {
        "dialog.officialSectionTitle": "官方直連 API",
        "dialog.officialSectionHint": "使用您手動填寫的憑證，並直接連接到官方端點 https://api.anthropic.com。",
        "dialog.officialPreset": "Anthropic 官方直連",
        "dialog.proxySectionTitle": "第三方 / 代理預設",
        "dialog.proxySectionHint": "以下預設會把請求路由到第三方或代理供應商端點，而不是 Anthropic 官方 API。",
        "dialog.apiUrlLockedHint": "官方直連模式固定使用 Anthropic 官方端點 https://api.anthropic.com。",
        "dialog.proxyEndpointWarning": "請求將透過該端點轉發，而不是直接傳送到 Anthropic 官方 API。",
    },
    "ja": {
        "dialog.officialSectionTitle": "公式ダイレクト API",
        "dialog.officialSectionHint": "手動で入力した認証情報を使用し、公式エンドポイント https://api.anthropic.com に直接接続します。",
        "dialog.officialPreset": "Anthropic 公式ダイレクト",
        "dialog.proxySectionTitle": "サードパーティ / プロキシプリセット",
        "dialog.proxySectionHint": "以下のプリセットは、Anthropic 公式 API ではなくサードパーティまたはプロキシプロバイダーのエンドポイントにリクエストをルーティングします。",
        "dialog.apiUrlLockedHint": "公式ダイレクトモードでは Anthropic 公式エンドポイント https://api.anthropic.com に固定されます。",
        "dialog.proxyEndpointWarning": "リクエストは Anthropic 公式 API へ直接送信されず、このエンドポイント経由で転送されます。",
    },
    "ko": {
        "dialog.officialSectionTitle": "공식 직접 연결 API",
        "dialog.officialSectionHint": "직접 입력한 자격 증명을 사용하여 공식 엔드포인트 https://api.anthropic.com에 연결합니다.",
        "dialog.officialPreset": "Anthropic 공식 직접 연결",
        "dialog.proxySectionTitle": "타사 / 프록시 프리셋",
        "dialog.proxySectionHint": "아래 프리셋은 Anthropic 공식 API가 아닌 타사 또는 프록시 제공자 엔드포인트로 요청을 라우팅합니다.",
        "dialog.apiUrlLockedHint": "공식 직접 연결 모드는 Anthropic 공식 엔드포인트 https://api.anthropic.com으로 고정됩니다.",
        "dialog.proxyEndpointWarning": "요청이 Anthropic 공식 API로 직접 전송되지 않고 해당 엔드포인트를 통해 전달됩니다.",
    },
    "es": {
        "dialog.officialSectionTitle": "API directa oficial",
        "dialog.officialSectionHint": "Use sus credenciales introducidas manualmente con el endpoint oficial https://api.anthropic.com.",
        "dialog.officialPreset": "Anthropic oficial directo",
        "dialog.proxySectionTitle": "Presets de terceros / proxy",
        "dialog.proxySectionHint": "Estos presets enrutan las solicitudes a través de un endpoint de proveedor tercero o proxy en lugar de la API oficial de Anthropic.",
        "dialog.apiUrlLockedHint": "El modo directo oficial siempre usa el endpoint fijo de Anthropic https://api.anthropic.com.",
        "dialog.proxyEndpointWarning": "Las solicitudes se enrutarán a través de ese endpoint en lugar de directamente a la API oficial de Anthropic.",
    },
    "fr": {
        "dialog.officialSectionTitle": "API directe officielle",
        "dialog.officialSectionHint": "Utilisez vos identifiants saisis manuellement avec l'endpoint officiel https://api.anthropic.com.",
        "dialog.officialPreset": "Anthropic officiel direct",
        "dialog.proxySectionTitle": "Préréglages tiers / proxy",
        "dialog.proxySectionHint": "Ces préréglages acheminent les requêtes via un endpoint tiers ou proxy plutôt que l'API officielle d'Anthropic.",
        "dialog.apiUrlLockedHint": "Le mode direct officiel utilise toujours l'endpoint fixe d'Anthropic https://api.anthropic.com.",
        "dialog.proxyEndpointWarning": "Les requêtes seront acheminées via cet endpoint plutôt que directement vers l'API officielle d'Anthropic.",
    },
    "ru": {
        "dialog.officialSectionTitle": "Официальный прямой API",
        "dialog.officialSectionHint": "Используйте вручную введённые учётные данные с официальной конечной точкой https://api.anthropic.com.",
        "dialog.officialPreset": "Официальное прямое подключение Anthropic",
        "dialog.proxySectionTitle": "Сторонние / прокси-пресеты",
        "dialog.proxySectionHint": "Эти пресеты направляют запросы через стороннюю или прокси-конечную точку поставщика, а не через официальный API Anthropic.",
        "dialog.apiUrlLockedHint": "В режиме официального прямого подключения всегда используется фиксированная конечная точка Anthropic https://api.anthropic.com.",
        "dialog.proxyEndpointWarning": "Запросы будут направляться через эту конечную точку, а не напрямую в официальный API Anthropic.",
    },
    "hi": {
        "dialog.officialSectionTitle": "आधिकारिक डायरेक्ट API",
        "dialog.officialSectionHint": "अपने मैन्युअल रूप से दर्ज क्रेडेंशियल उपयोग करें और आधिकारिक एंडपॉइंट https://api.anthropic.com से सीधे कनेक्ट करें।",
        "dialog.officialPreset": "Anthropic आधिकारिक डायरेक्ट",
        "dialog.proxySectionTitle": "थर्ड-पार्टी / प्रॉक्सी प्रीसेट",
        "dialog.proxySectionHint": "ये प्रीसेट अनुरोधों को Anthropic आधिकारिक API के बजाय थर्ड-पार्टी या प्रॉक्सी प्रदाता एंडपॉइंट के माध्यम से रूट करते हैं।",
        "dialog.apiUrlLockedHint": "आधिकारिक डायरेक्ट मोड हमेशा निश्चित Anthropic एंडपॉइंट https://api.anthropic.com उपयोग करता है।",
        "dialog.proxyEndpointWarning": "अनुरोध सीधे Anthropic आधिकारिक API के बजाय उस एंडपॉइंट के माध्यम से भेजे जाएंगे।",
    },
}

LOCAL_PROVIDER = {
    "zh-TW": {
        "vendor.localProviderName": "使用本地 settings.json",
        "vendor.localProviderDescription": "明確授權讀取 ~/.claude/settings.json",
        "vendor.localProviderAuthorizeTitle": "授權存取本地 settings.json",
        "vendor.localProviderAuthorizeMessage": "此操作將允許應用程式讀取 ~/.claude/settings.json，用於 Claude 請求。",
        "vendor.localProviderAuthorizeDetail": "您之後隨時可以取消此授權。應用程式不會修改您的本地檔案。",
        "vendor.localProviderDisableTitle": "取消本地 settings.json 授權",
        "vendor.localProviderDisableMessage": "此操作將停止使用 ~/.claude/settings.json，並讓 Claude 處於未啟用任何供應商的狀態，直到您再次明確啟用其他供應商。",
        "vendor.localProviderHelpTitle": "什麼是「使用本地 settings.json」？",
        "vendor.localProviderHelpBody": "讓應用程式讀取你已有的 ~/.claude/settings.json 來發起 Claude 請求——如果你已經透過 CLI 設定好 Claude、想直接複用那套設定，選這個最合適。\n\n• 應用程式只會讀取該檔案，絕不會修改它。\n• 你隨時可以取消授權。\n• 適合喜歡手動管理設定的進階使用者。\n• 適合使用第三方 cc-switch 管理的使用者。",
    },
    "ja": {
        "vendor.localProviderName": "ローカル settings.json を使用",
        "vendor.localProviderDescription": "~/.claude/settings.json の読み取りを明示的に許可",
        "vendor.localProviderAuthorizeTitle": "ローカル settings.json へのアクセスを許可",
        "vendor.localProviderAuthorizeMessage": "この操作により、アプリが Claude リクエストのために ~/.claude/settings.json を読み取ることを許可します。",
        "vendor.localProviderAuthorizeDetail": "この許可はいつでも取り消せます。アプリがローカルファイルを変更することはありません。",
        "vendor.localProviderDisableTitle": "ローカル settings.json の許可を取り消す",
        "vendor.localProviderDisableMessage": "この操作は ~/.claude/settings.json の使用を停止し、他のプロバイダーを明示的に有効にするまで、Claude はプロバイダー未設定の状態になります。",
        "vendor.localProviderHelpTitle": "「ローカル settings.json を使用」とは？",
        "vendor.localProviderHelpBody": "アプリが既存の ~/.claude/settings.json を読み取って Claude リクエストを行います——CLI で Claude を設定済みで、その設定をそのまま再利用したい場合に最適です。\n\n• アプリはこのファイルを読み取るだけで、変更しません。\n• 許可はいつでも取り消せます。\n• 設定を手動で管理したい上級ユーザー向け。\n• cc-switch などのサードパーティツールでプロバイダーを管理しているユーザーにも適しています。",
    },
    "ko": {
        "vendor.localProviderAuthorizeTitle": "로컬 settings.json 접근 승인",
        "vendor.localProviderAuthorizeMessage": "이 작업은 앱이 Claude 요청에 ~/.claude/settings.json을 읽도록 허용합니다.",
        "vendor.localProviderAuthorizeDetail": "이 승인은 언제든지 취소할 수 있습니다. 앱은 로컬 파일을 수정하지 않습니다.",
        "vendor.localProviderDisableTitle": "로컬 settings.json 승인 취소",
        "vendor.localProviderDisableMessage": "이 작업은 ~/.claude/settings.json 사용을 중지하고, 다른 공급자를 명시적으로 활성화할 때까지 Claude에 활성 공급자가 없는 상태로 둡니다.",
        "vendor.localProviderHelpTitle": "「로컬 settings.json 사용」이란?",
        "vendor.localProviderHelpBody": "앱이 기존 ~/.claude/settings.json을 읽어 Claude 요청을 보냅니다——CLI로 Claude를 이미 구성했고 그 구성을 그대로 재사용하려는 경우에 가장 적합합니다.\n\n• 앱은 파일을 읽기만 하며 수정하지 않습니다.\n• 언제든지 승인을 취소할 수 있습니다.\n• 구성을 수동으로 관리하는 고급 사용자에게 적합합니다.\n• cc-switch 같은 서드파티 도구로 공급자를 관리하는 사용자에게도 적합합니다.",
    },
    "es": {
        "vendor.localProviderName": "Usar settings.json local",
        "vendor.localProviderDescription": "Autorizar explícitamente la lectura de ~/.claude/settings.json",
        "vendor.localProviderAuthorizeTitle": "Autorizar acceso al settings.json local",
        "vendor.localProviderAuthorizeMessage": "Esto permitirá que la aplicación lea ~/.claude/settings.json para las solicitudes de Claude.",
        "vendor.localProviderAuthorizeDetail": "Puede revocar esta autorización en cualquier momento. La aplicación no modificará su archivo local.",
        "vendor.localProviderDisableTitle": "Revocar autorización del settings.json local",
        "vendor.localProviderDisableMessage": "Esto dejará de usar ~/.claude/settings.json y Claude quedará sin ningún proveedor activo hasta que habilite explícitamente otro.",
        "vendor.localProviderHelpTitle": "¿Qué es «Usar settings.json local»?",
        "vendor.localProviderHelpBody": "Permite que la aplicación lea su ~/.claude/settings.json existente para hacer solicitudes a Claude — ideal si ya configuró Claude mediante la CLI y desea reutilizar esa configuración.\n\n• La aplicación solo lee el archivo; nunca lo modifica.\n• Puede revocar esta autorización en cualquier momento.\n• Ideal para usuarios avanzados que gestionan la configuración manualmente.\n• Adecuado si gestiona proveedores con una herramienta de terceros como cc-switch.",
    },
    "fr": {
        "vendor.localProviderName": "Utiliser le settings.json local",
        "vendor.localProviderDescription": "Autoriser explicitement la lecture de ~/.claude/settings.json",
        "vendor.localProviderAuthorizeTitle": "Autoriser l'accès au settings.json local",
        "vendor.localProviderAuthorizeMessage": "Cela permettra à l'application de lire ~/.claude/settings.json pour les requêtes Claude.",
        "vendor.localProviderAuthorizeDetail": "Vous pouvez révoquer cette autorisation à tout moment. L'application ne modifiera pas votre fichier local.",
        "vendor.localProviderDisableTitle": "Révoquer l'autorisation du settings.json local",
        "vendor.localProviderDisableMessage": "Cela arrêtera l'utilisation de ~/.claude/settings.json et laissera Claude sans fournisseur actif jusqu'à ce que vous en activiez explicitement un autre.",
        "vendor.localProviderHelpTitle": "Qu'est-ce que « Utiliser le settings.json local » ?",
        "vendor.localProviderHelpBody": "Permet à l'application de lire votre ~/.claude/settings.json existant pour effectuer des requêtes Claude — idéal si vous avez déjà configuré Claude via la CLI et souhaitez réutiliser cette configuration.\n\n• L'application lit uniquement le fichier ; elle ne le modifie jamais.\n• Vous pouvez révoquer cette autorisation à tout moment.\n• Idéal pour les utilisateurs avancés qui gèrent la configuration manuellement.\n• Convient si vous gérez vos fournisseurs avec un outil tiers comme cc-switch.",
    },
    "pt-BR": {
        "vendor.localProviderAuthorizeMessage": "Isso permitirá que o aplicativo leia ~/.claude/settings.json para as requisições do Claude.",
        "vendor.localProviderAuthorizeDetail": "Você pode revogar esta autorização a qualquer momento. O aplicativo não modificará seu arquivo local.",
        "vendor.localProviderHelpTitle": "O que é \"Usar settings.json local\"?",
        "vendor.localProviderHelpBody": "Permite que o aplicativo leia seu ~/.claude/settings.json existente para fazer requisições ao Claude — ideal se você já configurou o Claude pela CLI e quer reutilizar essa configuração.\n\n• O aplicativo apenas lê o arquivo; nunca o modifica.\n• Você pode revogar esta autorização a qualquer momento.\n• Ideal para usuários avançados que gerenciam a configuração manualmente.\n• Adequado se você gerencia provedores com uma ferramenta de terceiros como o cc-switch.",
    },
    "ru": {
        "vendor.localProviderAuthorizeTitle": "Разрешить доступ к локальному settings.json",
        "vendor.localProviderAuthorizeMessage": "Это позволит приложению читать ~/.claude/settings.json для запросов Claude.",
        "vendor.localProviderAuthorizeDetail": "Вы можете отозвать это разрешение в любой момент. Приложение не изменит ваш локальный файл.",
        "vendor.localProviderDisableTitle": "Отозвать разрешение локального settings.json",
        "vendor.localProviderDisableMessage": "Это прекратит использование ~/.claude/settings.json, и Claude останется без активного поставщика, пока вы явно не включите другой.",
        "vendor.localProviderHelpTitle": "Что такое «Локальный settings.json»?",
        "vendor.localProviderHelpBody": "Позволяет приложению читать существующий ~/.claude/settings.json для запросов к Claude — идеально, если вы уже настроили Claude через CLI и хотите использовать эту конфигурацию.\n\n• Приложение только читает файл и никогда его не изменяет.\n• Вы можете отозвать это разрешение в любой момент.\n• Подходит опытным пользователям, предпочитающим ручное управление конфигурацией.\n• Удобно, если вы управляете поставщиками через сторонний инструмент, например cc-switch.",
    },
    "hi": {
        "vendor.localProviderName": "लोकल settings.json उपयोग करें",
        "vendor.localProviderDescription": "~/.claude/settings.json पढ़ने के लिए स्पष्ट अनुमति दें",
        "vendor.localProviderAuthorizeTitle": "लोकल settings.json तक पहुँच अधिकृत करें",
        "vendor.localProviderAuthorizeMessage": "यह ऐप को Claude अनुरोधों के लिए ~/.claude/settings.json पढ़ने की अनुमति देगा।",
        "vendor.localProviderAuthorizeDetail": "आप कभी भी यह अनुमति रद्द कर सकते हैं। ऐप आपकी लोकल फ़ाइल को संशोधित नहीं करेगा।",
        "vendor.localProviderDisableTitle": "लोकल settings.json अनुमति रद्द करें",
        "vendor.localProviderDisableMessage": "यह ~/.claude/settings.json का उपयोग बंद कर देगा और Claude बिना किसी सक्रिय प्रदाता के रहेगा, जब तक आप स्पष्ट रूप से कोई अन्य सक्षम नहीं करते।",
        "vendor.localProviderHelpTitle": "「लोकल settings.json उपयोग करें」 क्या है?",
        "vendor.localProviderHelpBody": "ऐप को आपकी मौजूदा ~/.claude/settings.json पढ़कर Claude अनुरोध भेजने देता है — यदि आपने CLI से Claude कॉन्फ़िगर किया है और वही कॉन्फ़िगरेशन दोबारा उपयोग करना चाहते हैं तो यह सबसे उपयुक्त है।\n\n• ऐप केवल फ़ाइल पढ़ता है, उसे कभी संशोधित नहीं करता।\n• आप कभी भी यह अनुमति रद्द कर सकते हैं।\n• मैन्युअल कॉन्फ़िगरेशन पसंद करने वाले उन्नत उपयोगकर्ताओं के लिए उपयुक्त।\n• cc-switch जैसे तृतीय-पक्ष टूल से प्रदाता प्रबंधित करने वालों के लिए भी उपयुक्त।",
    },
}

CODEX_DIALOG = {
    "zh-TW": {
        "codexDialog.editTitle": "編輯供應商: {{name}}",
        "codexDialog.formatJson": "格式化",
        "codexDialog.formatError": "格式化失敗，JSON 格式錯誤",
        "codexDialog.nameRequired": "請輸入供應商名稱",
        "codexDialog.authJsonError": "auth.json JSON 格式錯誤",
    },
    "ja": {
        "codexDialog.editTitle": "プロバイダーを編集: {{name}}",
        "codexDialog.officialPreset": "OpenAI 公式ダイレクト",
        "codexDialog.officialSectionHint": "手動で入力した OPENAI_API_KEY を使用し、公式エンドポイント https://api.openai.com/v1 に直接接続します。",
        "codexDialog.presetHint": "以下のプリセットは Claude Code プロバイダーと同じサードパーティまたはプロキシエンドポイントのみを含みます。",
        "codexDialog.formatJson": "フォーマット",
        "codexDialog.formatError": "フォーマットに失敗しました。JSON が無効です",
        "codexDialog.nameRequired": "プロバイダー名を入力してください",
        "codexDialog.authJsonError": "auth.json の JSON 形式エラー",
    },
    "es": {
        "codexDialog.editTitle": "Editar proveedor: {{name}}",
        "codexDialog.officialPreset": "OpenAI oficial directo",
        "codexDialog.officialSectionHint": "Use su OPENAI_API_KEY introducida manualmente con el endpoint oficial https://api.openai.com/v1.",
        "codexDialog.presetHint": "Estos presets solo incluyen endpoints de terceros o proxy que coinciden con el conjunto de proveedores de Claude Code.",
        "codexDialog.formatJson": "Formatear",
        "codexDialog.formatError": "Error al formatear, JSON no válido",
        "codexDialog.nameRequired": "Introduzca el nombre del proveedor",
        "codexDialog.authJsonError": "Error de formato JSON en auth.json",
    },
    "fr": {
        "codexDialog.editTitle": "Modifier le fournisseur: {{name}}",
        "codexDialog.officialPreset": "OpenAI officiel direct",
        "codexDialog.officialSectionHint": "Utilisez votre OPENAI_API_KEY saisie manuellement avec l'endpoint officiel https://api.openai.com/v1.",
        "codexDialog.presetHint": "Ces préréglages incluent uniquement des endpoints tiers ou proxy correspondant à l'ensemble des fournisseurs Claude Code.",
        "codexDialog.formatJson": "Formater",
        "codexDialog.formatError": "Échec du formatage, JSON invalide",
        "codexDialog.nameRequired": "Veuillez saisir le nom du fournisseur",
        "codexDialog.authJsonError": "Erreur de format JSON dans auth.json",
    },
    "hi": {
        "codexDialog.editTitle": "प्रदाता संपादित करें: {{name}}",
        "codexDialog.officialPreset": "OpenAI आधिकारिक डायरेक्ट",
        "codexDialog.officialSectionHint": "अपनी मैन्युअल रूप से दर्ज OPENAI_API_KEY उपयोग करें और आधिकारिक एंडपॉइंट https://api.openai.com/v1 से सीधे कनेक्ट करें।",
        "codexDialog.presetHint": "ये प्रीसेट केवल Claude Code प्रदाता सेट से मेल खाने वाले थर्ड-पार्टी या प्रॉक्सी एंडपॉइंट शामिल करते हैं।",
        "codexDialog.formatJson": "फ़ॉर्मैट करें",
        "codexDialog.formatError": "फ़ॉर्मैट विफल, अमान्य JSON",
        "codexDialog.nameRequired": "कृपया प्रदाता नाम दर्ज करें",
        "codexDialog.authJsonError": "auth.json JSON प्रारूप त्रुटि",
    },
}

PRESETS_MANUAL = {
    "zh-TW": {"presets.custom": "自訂配置"},
    "es": {"presets.custom": "Personalizado"},
    "fr": {"presets.custom": "Personnalisé"},
    "hi": {"presets.custom": "कस्टम"},
}

IMPORT_MENU_MANUAL = {
    "zh-TW": {"importMenu.fromCcSwitchFile": "選擇 cc-switch.db 檔案匯入"},
    "es": {"importMenu.fromCcSwitchFile": "Seleccionar archivo cc-switch.db para importar"},
    "fr": {"importMenu.fromCcSwitchFile": "Sélectionner un fichier cc-switch.db à importer"},
    "hi": {"importMenu.fromCcSwitchFile": "आयात के लिए cc-switch.db फ़ाइल चुनें"},
}

MANUAL = {}
for table in (CC6, DIALOG_SECTIONS, LOCAL_PROVIDER, CODEX_DIALOG, PRESETS_MANUAL, IMPORT_MENU_MANUAL):
    for loc, entries in table.items():
        MANUAL.setdefault(loc, {}).update(entries)
for loc, value in GOT_IT.items():
    MANUAL.setdefault(loc, {})["vendor.gotIt"] = value
for loc, value in WHAT_IS_THIS.items():
    MANUAL.setdefault(loc, {})["vendor.whatIsThis"] = value

# ---------------------------------------------------------------- helpers ---
def load_ref(loc):
    with open(f"{REF}/webview/src/i18n/locales/{loc}.json") as f:
        return json.load(f)

def ts_str(value):
    return json.dumps(value, ensure_ascii=False)

def find_line(lines, pattern, start=0):
    for i in range(start, len(lines)):
        if re.search(pattern, lines[i]):
            return i
    return -1

def find_block_end(lines, start):
    indent = len(lines[start]) - len(lines[start].lstrip())
    for i in range(start + 1, len(lines)):
        stripped = lines[i].strip()
        cur_indent = len(lines[i]) - len(lines[i].lstrip())
        if cur_indent == indent and (stripped == "}," or stripped == "}"):
            return i
    return -1

def extract_flat_block(lines, start, end):
    result = {}
    for i in range(start + 1, end):
        m = re.match(r'\s*"?([A-Za-z0-9_]+)"?:\s*(.*)', lines[i])
        if m and m.group(2).startswith('"'):
            value = m.group(2)
            j = i
            while not re.search(r'",?\s*$', value) and j + 1 < end:
                j += 1
                value += "\n" + lines[j].strip()
            result[m.group(1)] = value
    return result

def emit_block(indent_str, header, entries, quoted):
    q = (lambda k: f'"{k}"') if quoted else (lambda k: k)
    out = [f"{indent_str}{q(header)}: {{"]
    for key, value in entries:
        out.append(f"{indent_str}  {q(key)}: {value},")
    out.append(f"{indent_str}}},")
    return out

def replace_key_value(lines, idx, new_stmt_lines):
    end = idx
    while not re.search(r'",?\s*$', lines[end]):
        end += 1
    return lines[:idx] + new_stmt_lines + lines[end + 1:]

def ensure_trailing_comma(lines, idx):
    """在 idx(块结束行) 处插入前, 确保前一个非空行以逗号结尾"""
    j = idx - 1
    while j >= 0 and not lines[j].strip():
        j -= 1
    if j >= 0 and not lines[j].rstrip().endswith(","):
        lines[j] = lines[j].rstrip() + ","

def ref_get(ref, *path):
    node = ref
    for p in path:
        if not isinstance(node, dict) or p not in node:
            return None
        node = node[p]
    return node

def desktopize(loc, value):
    if value is None:
        return None
    if loc == "zh":
        return value.replace("插件", "应用")
    if loc == "en":
        return value.replace("the plugin", "the app").replace("The plugin", "The app")
    return value

failures = []

for loc in LOCALES:
    ref = load_ref(loc)
    manual = MANUAL.get(loc, {})

    def val(scoped_key, *ref_path, desktop=False):
        if scoped_key in manual:
            return manual[scoped_key]
        node = ref_get(ref, *ref_path)
        if node is None:
            failures.append(f"{loc}: {scoped_key} missing in ref and MANUAL")
            return ""
        return desktopize(loc, node) if desktop else node

    path = f"{DESKTOP}/src/i18n/locales/{loc}/settings.ts"
    with open(path) as f:
        lines = f.read().split("\n")

    quoted = not any(re.match(r"\s*ccSwitchImport: \{", line) for line in lines)
    q = (lambda k: f'"{k}"') if quoted else (lambda k: k)

    def key_pat(key):
        return rf'^\s*"?{re.escape(key)}"?:\s*'

    rp = ("settings", "provider")
    rid = rp + ("importDialog",)

    # ---------- 1. ccSwitchImport ----------
    cc_start = find_line(lines, key_pat("ccSwitchImport") + r"\{")
    third_party = find_line(lines, key_pat("thirdPartyConfig"))
    if third_party >= 0:
        anchor = third_party
        indent_str = lines[anchor][: len(lines[anchor]) - len(lines[anchor].lstrip())]
    else:
        # 无 thirdPartyConfig 的 locale: 插在 vendor 块起始行之后
        anchor = find_line(lines, key_pat("vendor") + r"\{")
        if anchor < 0:
            failures.append(f"{loc}: vendor block not found")
            continue
        anchor_indent = len(lines[anchor]) - len(lines[anchor].lstrip())
        indent_str = " " * (anchor_indent + 2)

    new_entries = [
        ("entry", val("cc.entry", *rp, "import")),
        ("title", val("cc.title", *rid, "title")),
        ("summary", val("cc.summary", *rid, "summary")),
        ("newCount", val("cc.newCount", *rid, "newCount")),
        ("updateCount", val("cc.updateCount", *rid, "updateCount")),
        ("columnName", val("cc.columnName", *rid, "columnName")),
        ("columnId", val("cc.columnId", *rid, "columnId")),
        ("columnStatus", val("cc.columnStatus", *rid, "columnStatus")),
        ("statusNew", val("cc.statusNew", *rid, "statusNew")),
        ("statusUpdate", val("cc.statusUpdate", *rid, "statusUpdate")),
        ("selectAll", None),
        ("refresh", None),
        ("loading", val("cc.loading", *rp, "readingCcSwitch")),
        ("emptySource", None),
        ("emptyCategory", None),
        ("successBanner", None),
        ("failureBanner", None),
        ("selectedCount", val("cc.selectedCount", *rid, "selectedCount")),
        ("confirmImport", val("cc.confirmImport", *rid, "confirmImport")),
        ("cancel", val("cc.cancel", "common", "cancel")),
        ("close", val("cc.close", "common", "close")),
        ("importing", val("cc.importing", *rp, "importing")),
    ]

    if cc_start >= 0:
        # zh/en: 保留 desktop 既有值
        cc_end = find_block_end(lines, cc_start)
        old = extract_flat_block(lines, cc_start, cc_end)
        merged = []
        for key, value in new_entries:
            if value is None:
                if key not in old:
                    failures.append(f"{loc}: ccSwitchImport.{key} missing")
                    value = ts_str("")
                else:
                    value = old[key].rstrip(",").strip()
            merged.append((key, ts_str(value) if not value.startswith('"') else value))
        new_block = emit_block(indent_str, "ccSwitchImport", merged, quoted)
        lines = lines[:cc_start] + new_block + lines[cc_end + 1:]
        insert_at = cc_start + len(new_block)
    else:
        merged = []
        for key, value in new_entries:
            if value is None:
                value = val(f"cc.{key}")  # MANUAL 必填
            merged.append((key, ts_str(value)))
        new_block = emit_block(indent_str, "ccSwitchImport", merged, quoted)
        insert_at = anchor + 1
        lines = lines[:insert_at] + new_block + lines[insert_at:]
        insert_at += len(new_block)

    # ---------- 2. importMenu ----------
    menu_block = emit_block(indent_str, "importMenu", [
        ("fromCcSwitchUpdate", ts_str(val("importMenu.fromCcSwitchUpdate", *rp, "importFromCcSwitchUpdate"))),
        ("fromCcSwitchFile", ts_str(val("importMenu.fromCcSwitchFile", *rp, "importFromCcSwitchFile"))),
    ], quoted)
    lines = lines[:insert_at] + menu_block + lines[insert_at:]

    # ---------- 3. localProvider* + vendor 顶层新增 ----------
    lpn = find_line(lines, key_pat("localProviderName"), insert_at)
    if lpn < 0:
        failures.append(f"{loc}: localProviderName not found")
        continue
    indent2 = lines[lpn][: len(lines[lpn]) - len(lines[lpn].lstrip())]
    lines = replace_key_value(lines, lpn, [
        f"{indent2}{q('localProviderName')}: {ts_str(val('vendor.localProviderName', *rp, 'localProviderName', desktop=True))},",
    ])
    lpd = find_line(lines, key_pat("localProviderDescription"), lpn)
    lines = replace_key_value(lines, lpd, [
        f"{indent2}{q('localProviderDescription')}: {ts_str(val('vendor.localProviderDescription', *rp, 'localProviderDescription', desktop=True))},",
    ])
    new_vendor_keys = [
        ("allProviders", val("vendor.allProviders", *rp, "allProviders")),
        ("authorizeAndEnable", val("vendor.authorizeAndEnable", *rp, "authorizeAndEnable")),
        ("revokeAuthorization", val("vendor.revokeAuthorization", *rp, "revokeAuthorization")),
        ("whatIsThis", val("vendor.whatIsThis", *rp, "whatIsThis")),
        ("gotIt", val("vendor.gotIt", "common", "gotIt")),
        ("localProviderAuthorizeTitle", val("vendor.localProviderAuthorizeTitle", *rp, "localProviderAuthorizeTitle", desktop=True)),
        ("localProviderAuthorizeMessage", val("vendor.localProviderAuthorizeMessage", *rp, "localProviderAuthorizeMessage", desktop=True)),
        ("localProviderAuthorizeDetail", val("vendor.localProviderAuthorizeDetail", *rp, "localProviderAuthorizeDetail", desktop=True)),
        ("localProviderDisableTitle", val("vendor.localProviderDisableTitle", *rp, "localProviderDisableTitle")),
        ("localProviderDisableMessage", val("vendor.localProviderDisableMessage", *rp, "localProviderDisableMessage")),
        ("localProviderHelpTitle", val("vendor.localProviderHelpTitle", *rp, "localProviderHelpTitle")),
        ("localProviderHelpBody", val("vendor.localProviderHelpBody", *rp, "localProviderHelpBody", desktop=True)),
    ]
    # 跳过该 locale vendor 块中已存在的键(避免重复, 如 ja 已有 allProviders)
    vendor_start = find_line(lines, key_pat("vendor") + r"\{")
    vendor_dialog = find_line(lines, key_pat("dialog") + r"\{", lpd)
    scan_end = vendor_dialog if vendor_dialog > 0 else len(lines)
    def vendor_key_exists(key):
        for i in range(vendor_start, scan_end):
            if re.match(rf'^\s*"?{re.escape(key)}"?:', lines[i]):
                return True
        return False
    insert_lines = [
        f"{indent2}{q(k)}: {ts_str(v)},"
        for k, v in new_vendor_keys
        if not vendor_key_exists(k)
    ]
    lines = lines[: lpd + 1] + insert_lines + lines[lpd + 1:]

    # ---------- 4. dialog ----------
    dlg = find_line(lines, key_pat("dialog") + r"\{", lpd)
    if dlg < 0:
        failures.append(f"{loc}: dialog block not found")
        continue
    et = find_line(lines, key_pat("editTitle"), dlg)
    et_indent = lines[et][: len(lines[et]) - len(lines[et].lstrip())]
    lines = replace_key_value(lines, et, [
        f"{et_indent}{q('editTitle')}: {ts_str(val('dialog.editTitle', *rp, 'dialog', 'editTitle'))},",
    ])
    dlg_end = find_block_end(lines, dlg)
    pg = find_line(lines, key_pat("presetGroup"), dlg)
    if 0 < pg < dlg_end:
        del lines[pg]
    dlg_end = find_block_end(lines, dlg)
    new_dialog_keys = [
        ("officialSectionTitle", val("dialog.officialSectionTitle", *rp, "dialog", "officialSectionTitle")),
        ("officialSectionHint", val("dialog.officialSectionHint", *rp, "dialog", "officialSectionHint")),
        ("officialPreset", val("dialog.officialPreset", *rp, "dialog", "officialPreset")),
        ("proxySectionTitle", val("dialog.proxySectionTitle", *rp, "dialog", "proxySectionTitle")),
        ("proxySectionHint", val("dialog.proxySectionHint", *rp, "dialog", "proxySectionHint")),
        ("apiUrlLockedHint", val("dialog.apiUrlLockedHint", *rp, "dialog", "apiUrlLockedHint")),
        ("proxyEndpointWarning", val("dialog.proxyEndpointWarning", *rp, "dialog", "proxyEndpointWarning")),
        ("fableModel", val("dialog.fableModel", *rp, "dialog", "fableModel")),
        ("fableModelPlaceholder", val("dialog.fableModelPlaceholder", *rp, "dialog", "fableModelPlaceholder")),
    ]
    insert_lines = [f"{et_indent}{q(k)}: {ts_str(v)}," for k, v in new_dialog_keys]
    ensure_trailing_comma(lines, dlg_end)
    lines = lines[:dlg_end] + insert_lines + lines[dlg_end:]

    # ---------- 5. presets ----------
    ps = find_line(lines, key_pat("presets") + r"\{", dlg_end)
    if ps < 0:
        failures.append(f"{loc}: presets block not found")
        continue
    ps_end = find_block_end(lines, ps)
    ps_indent = lines[ps][: len(lines[ps]) - len(lines[ps].lstrip())]
    preset_order = ["custom", "zhipu", "kimi", "kimiCoding", "deepseek", "minimax",
                    "xiaomi", "xiaomiPlan", "bailian", "bailianCoding", "longcat",
                    "opencodeGo", "openrouter"]
    new_block = emit_block(ps_indent, "presets", [
        (k, ts_str(val(f"presets.{k}", *rp, "presets", k))) for k in preset_order
    ], quoted)
    lines = lines[:ps] + new_block + lines[ps_end + 1:]

    # ---------- 6. codexDialog ----------
    cd = find_line(lines, key_pat("codexDialog") + r"\{", ps)
    if cd < 0:
        failures.append(f"{loc}: codexDialog block not found")
        continue
    et2 = find_line(lines, key_pat("editTitle"), cd)
    et2_indent = lines[et2][: len(lines[et2]) - len(lines[et2].lstrip())]
    lines = replace_key_value(lines, et2, [
        f"{et2_indent}{q('editTitle')}: {ts_str(val('codexDialog.editTitle', 'settings', 'codexProvider', 'dialog', 'editTitle'))},",
    ])
    cd_end = find_block_end(lines, cd)
    new_codex_keys = [
        ("officialPreset", val("codexDialog.officialPreset", "settings", "codexProvider", "dialog", "officialPreset")),
        ("officialSectionHint", val("codexDialog.officialSectionHint", "settings", "codexProvider", "dialog", "officialSectionHint")),
        ("presetHint", val("codexDialog.presetHint", "settings", "codexProvider", "dialog", "presetHint")),
        ("formatJson", val("codexDialog.formatJson", "settings", "codexProvider", "dialog", "formatJson")),
        ("formatError", val("codexDialog.formatError", "settings", "codexProvider", "dialog", "formatError")),
        ("nameRequired", val("codexDialog.nameRequired", "settings", "codexProvider", "dialog", "nameRequired")),
        ("authJsonError", val("codexDialog.authJsonError", "settings", "codexProvider", "dialog", "authJsonError")),
    ]
    insert_lines = [f"{et2_indent}{q(k)}: {ts_str(v)}," for k, v in new_codex_keys]
    ensure_trailing_comma(lines, cd_end)
    lines = lines[:cd_end] + insert_lines + lines[cd_end:]

    # ---------- 7. deleteConfirm.message ----------
    dc = find_line(lines, key_pat("deleteConfirm") + r"\{", cd)
    dc_end = find_block_end(lines, dc) if dc >= 0 else -1
    msg = find_line(lines, key_pat("message"), dc) if dc >= 0 else -1
    if 0 < msg < dc_end:
        msg_indent = lines[msg][: len(lines[msg]) - len(lines[msg].lstrip())]
        lines = replace_key_value(lines, msg, [
            f"{msg_indent}{q('message')}: {ts_str(val('deleteConfirm.message', *rp, 'deleteMessage'))},",
        ])
    else:
        failures.append(f"{loc}: deleteConfirm.message not found")

    with open(path, "w") as f:
        f.write("\n".join(lines))
    print(f"{loc}: patched")

if failures:
    print("\nFAILURES:")
    for f in failures:
        print(" ", f)
    sys.exit(1)
print("\nall locales patched")
