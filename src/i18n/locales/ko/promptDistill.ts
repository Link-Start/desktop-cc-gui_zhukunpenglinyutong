// promptDistill — 한국어 UI 문자열
const promptDistill = {
  promptDistill: {
    menuSaveAsPrompt: "선택 영역으로 명령 생성",
    menuSaveThreadAsPrompt: "전체 스레드로 명령 생성",
    dialogTitle: "명령 생성",
    dialogDescription:
      "대화 내용을 재사용 가능한 슬래시 명령으로 추출합니다. 저장하면 현재 워크스페이스 명령 디렉터리에 기록되며, 이후 입력창에서 / 를 입력해 호출할 수 있습니다. 템플릿의 $ARGUMENTS 는 호출 시 입력한 인자로 바뀝니다.",
    nameLabel: "명령 이름",
    namePlaceholder: "예: review-checklist",
    contentLabel: "명령 템플릿",
    argumentsHint: "/명령 호출 시 전달할 인자가 들어갈 위치에 $ARGUMENTS 를 사용하세요.",
    distilling: "명령 생성 중…",
    save: "저장",
    saving: "저장 중…",
    cancel: "취소",
    nameInvalid:
      "소문자, 숫자, 하이픈, 밑줄만 사용할 수 있으며 문자나 숫자로 시작해야 합니다.",
    failedTimeout: "명령 생성 시간이 초과되었습니다({{seconds}}초)",
    failedEmpty: "엔진이 빈 명령 템플릿을 반환했습니다",
    failedGeneric: "명령 생성에 실패했습니다",
    savedTitle: "명령 저장됨",
    savedMessage: "/{{name}} 으로 저장되었습니다. 입력창에서 / 를 입력해 호출하세요.",
  },
};

export default promptDistill;
