// sharedSend — Строки UI на русском (Wave 4 / Change B §14.5 конечный автомат)
const sharedSend = {
  sharedSend: {
    preparingContext: "Подготовка контекста общей сессии…",
    degradedTitle: "Деградированный контекст",
    degradedHint:
      "Проекция контекста содержит omissions. Ход не будет отправлен без вашего подтверждения.",
    degradedConfirm: "Всё равно отправить",
    awaitingAcceptance: "Доставка… ожидание подтверждения получения от runtime.",
    cancelUnsupported:
      "Этот адаптер не может отменить ожидающую доставку; дождитесь вердикта runtime.",
    cancelPending: "Подтверждение результата отмены…",
    settling: "Сохранение результата…",
    recoveryTitle: "Требуется восстановление",
    recoveryHint:
      "У последней отправки неоднозначное подтверждение, поэтому эта общая сессия заблокирована. Выполните probe устойчивых данных или явно пересоздайте binding.",
    recoveryProbe: "Probe",
    recoveryProbing: "Выполняется probe…",
    recoveryRebuild: "Пересоздать binding",
    recoveryProbeHeld:
      "Probe нашёл принятую, но незафиксированную попытку. Сессия остаётся заблокированной ради порядка.",
    recoveryProbeCleared: "Probe не нашёл ожидающих попыток. Сессия разблокирована.",
    targetUnavailable: "Выбранная цель недоступна.",
    targetUnavailableReason: "Выбранная цель недоступна: {{reason}}",
    cancel: "Отмена",
  },
};

export default sharedSend;
