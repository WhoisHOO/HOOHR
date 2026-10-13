import type { CommonMessages } from "./common";

/** Company settings admin copy. See common.ts for strings shared across modules. */

export const settingsKo = {
  page: {
    title: "회사 설정",
    subtitle: "회사 기본 정보, 휴가 정책, 공휴일, 경비 분류를 관리합니다.",
  },
  sections: {
    company: {
      title: "회사 정보",
      description:
        "회사명과 국가를 지정합니다. 국가가 통화와 시간대, 표시 언어를 정합니다.",
    },
    policy: {
      title: "휴가 정책",
      description:
        "유형별 연간 부여 일수와 이월 한도를 관리합니다. 정책 값은 신청 가능 여부에, 부여일 반영은 잔액에 적용됩니다.",
    },
    holiday: {
      title: "공휴일",
      description:
        "등록된 공휴일은 휴가 신청일수 계산에서 자동으로 제외됩니다.",
    },
    category: {
      title: "경비 분류",
      description:
        "경비 신청에서 사용할 분류입니다. 사용 중인 분류는 삭제 대신 비활성화합니다.",
    },
    mail: {
      title: "이메일 알림",
      description:
        "휴가·영수증 신청이 들어오면 관리자에게 이메일이 갑니다. 비워 두면 알림 없이 사용합니다.",
      passKept: "저장된 비밀번호가 있습니다. 비워 두면 유지됩니다.",
    },
    logo: {
      title: "회사 로고",
      description:
        "사이드바 상단에 회사명과 함께 표시됩니다. JPG·PNG·WEBP, 1MB 이하.",
    },
    notice: {
      title: "공지사항",
      description:
        "대시보드 맨 위에 표시됩니다. 비워 두면 표시되지 않습니다.",
      placeholder: "예: 다음 주 월요일은 창립기념일로 쉽니다.",
    },
    external: {
      title: "외부 접속",
      description:
        "직원이 회사 밖에서 들어오는 주소입니다. 초대·알림 링크도 이 주소로 만들어집니다.",
      none: "공개 주소가 없습니다. 지금은 이 PC에서만 접속됩니다 (start-tunnel.bat으로 공개).",
      quick: "임시 주소입니다. 터널을 다시 켜면 바뀌고, 바뀐 뒤에는 직원에게 새 주소를 알려야 합니다.",
      stable: "고정 주소입니다. 다시 켜도 바뀌지 않습니다.",
      check: "연결 확인",
      reachable: "외부에서 도달 가능합니다.",
      unreachable:
        "외부에서 도달할 수 없습니다. 터널이 켜져 있는지 확인하세요.",
    },
    transfer: {
      title: "이사 (다른 PC로 옮기기)",
      description:
        "데이터 전체를 파일 하나로 내려받아 새 PC에 올리면 그대로 이어집니다. 로그인 비밀번호는 새로 만든 설치의 것으로 다시 로그인하세요.",
      download: "백업 내려받기",
      file: "백업 파일",
      confirm: "기존 데이터를 전부 지우고 덮어쓴다는 것을 이해했습니다",
      restore: "복원하기",
      restoring: "복원 중...",
    },
  },
  labels: {
    companyName: "회사명",
    country: "국가 (통화·언어가 맞춰집니다)",
    policyName: "정책명",
    annualDays: "연간 부여 일수",
    maxCarryOver: "이월 한도",
    isPaid: "유급",
    requiresApproval: "승인 필요",
    inUse: "사용 중",
    inactive: "비활성",
    holidayName: "공휴일명",
    categoryName: "분류명",
    newCategoryName: "새 분류명",
    weekend: "주말 요일",
  },
  weekdays: {
    sun: "일",
    mon: "월",
    tue: "화",
    wed: "수",
    thu: "목",
    fri: "금",
    sat: "토",
  },
  placeholders: {
    holidayName: "예: 설날 연휴",
    categoryName: "예: 교육비",
  },
  actions: {
    savePolicy: "정책 저장",
    applyToYear: "{year}년 잔액에 부여일 반영",
    addHoliday: "공휴일 등록",
    addCategory: "분류 추가",
    thisYear: "올해로",
    yearPrev: "← {year}년",
    yearCurrent: "{year}년",
    yearNext: "{year}년 →",
  },
  /** Pending copy for the settings-only operations. */
  pending: {
    applying: "적용 중...",
    addingHoliday: "등록 중...",
    addingCategory: "추가 중...",
    deleting: "삭제 중...",
  },
  counts: {
    items: "{n}개",
    holidays: "{year}년 {n}개",
    balanceRows: "잔액 행 {n}건",
    categoryItems: "항목 {n}건",
  },
  hints: {
    applyToYear:
      "기존 잔액 행의 부여 일수만 갱신합니다 (사용일·조정일 유지).",
    deleteBlocked: "사용 중인 분류는 삭제할 수 없습니다",
  },
  empty: {
    holidays: "{year}년에 등록된 공휴일이 없습니다.",
    categories: "등록된 분류가 없습니다.",
  },
  a11y: {
    deleteHoliday: "{name} 삭제",
  },
  /** Date prefix for the holiday list row; the day itself comes from formatLeaveDay. */
  item: {
    holidayLabel: "{date} {name}",
  },
  validation: {
    idRequired: "필수 정보를 입력하세요",
    idInvalid: "필수 정보가 올바르지 않습니다",
    dateRequired: "날짜를 선택하세요",
    dateInvalid: "날짜가 올바르지 않습니다",
    nameTooLong: "{label}은 100자 이내입니다",
    daysNegative: "{label}은 0 이상이어야 합니다",
    daysTooMany: "{label}은 365 이하여야 합니다",
    valueInvalid: "값이 올바르지 않습니다",
    countryInvalid: "지원하지 않는 국가입니다. 대한민국 또는 미국을 선택하세요.",
    weekendRequired: "주말 요일을 한 개 이상 선택하세요",
    weekendAllOff: "적어도 하루는 근무일로 남겨야 합니다",
    weekendInvalid: "주말 요일 값이 올바르지 않습니다",
    noticeTooLong: "공지사항은 500자 이내입니다",
  },
  messages: {
    companySaved: "회사 설정이 저장되었습니다.",
    mailSaved: "이메일 알림 설정이 저장되었습니다.",
    mailSaveFailed: "저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
    logoSaved: "회사 로고가 저장되었습니다.",
    logoRemoved: "회사 로고를 지웠습니다.",
    logoRequired: "로고 이미지 파일을 선택해주세요.",
    noticeSaved: "공지사항이 저장되었습니다.",
    transferFailed: "복원하지 못했습니다. 잠시 후 다시 시도해주세요.",
    transferFileRequired: "백업 파일을 선택해주세요.",
    transferTooLarge: "파일이 너무 큽니다 (256MB 이하).",
    transferBadFile: "백업 파일이 아닙니다.",
    transferVersionMismatch: "버전이 다른 백업입니다. 같은 버전에서 만든 파일을 올리세요.",
    transferConfirmRequired: "덮어쓰기 확인에 체크해주세요.",
    transferRestored: "복원되었습니다.",
    policyNotFound: "휴가 정책을 찾을 수 없습니다.",
    policyNameTaken: "같은 이름의 휴가 정책이 이미 있습니다.",
    policySaved: "휴가 정책이 저장되었습니다. ({name})",
    policyApplySkipped:
      "{year}년 잔액 행이 없어 반영하지 않았습니다. (CSV 임포트 또는 정책 적용 대상 없음)",
    policyApplied: "{year}년 잔액 {rows}에 {days}를 부여했습니다.",
    holidayExists: "이미 등록된 공휴일입니다.",
    holidayCreated: "공휴일이 등록되었습니다.",
    holidayNotFound: "공휴일을 찾을 수 없습니다.",
    holidayDeleted: "공휴일이 삭제되었습니다.",
    categoryNameTaken: "이미 존재하는 분류명입니다.",
    categoryNotFound: "분류를 찾을 수 없습니다.",
    categoryInUse:
      "사용 중인 분류({name})는 삭제할 수 없습니다. 비활성화하세요.",
    categoryCreated: "경비 분류가 추가되었습니다.",
    categorySaved: "경비 분류가 저장되었습니다.",
    categoryDeleted: "경비 분류가 삭제되었습니다.",
  },
};

export type SettingsMessages = typeof settingsKo;

export const settingsEn: SettingsMessages = {
  page: {
    title: "Company settings",
    subtitle:
      "Manage your company details, leave policies, public holidays and expense categories.",
  },
  sections: {
    company: {
      title: "Company details",
      description:
        "Set the company name and country. The country decides the currency, the timezone and the display language.",
    },
    policy: {
      title: "Leave policies",
      description:
        "Manage the annual grant and carry-over limit per leave type. The policy values decide what can be requested, and applying the grant writes to the balances.",
    },
    holiday: {
      title: "Public holidays",
      description:
        "Registered public holidays are excluded from leave day counts automatically.",
    },
    category: {
      title: "Expense categories",
      description:
        "Categories used when filing expenses. A category that is in use is deactivated instead of deleted.",
    },
    mail: {
      title: "Email alerts",
      description:
        "When a leave or receipt request arrives, the admins get an email. Leave it empty to run without alerts.",
      passKept: "A password is stored. Leave it empty to keep it.",
    },
    logo: {
      title: "Company logo",
      description:
        "Shown with the company name at the top of the sidebar. JPG, PNG or WEBP, up to 1MB.",
    },
    notice: {
      title: "Notice",
      description:
        "Shown at the top of the dashboard. Leave it empty to hide it.",
      placeholder: "e.g. Next Monday is Foundation Day — the day off.",
    },
    external: {
      title: "Public access",
      description:
        "The address staff use from outside the office. Invite and alert links use it too.",
      none: "No public address. Only this PC can connect (run start-tunnel.bat to share).",
      quick: "Temporary address. It changes when the tunnel restarts — tell the staff the new one.",
      stable: "Stable address. It does not change on restart.",
      check: "Check connection",
      reachable: "Reachable from the outside.",
      unreachable:
        "Not reachable from the outside. Check that the tunnel is running.",
    },
    transfer: {
      title: "Move (to another PC)",
      description:
        "Download everything as one file, upload it on the new PC, and continue. Everyone logs in again with the new install.",
      download: "Download backup",
      file: "Backup file",
      confirm: "I understand this erases all existing data here",
      restore: "Restore",
      restoring: "Restoring...",
    },
  },
  labels: {
    companyName: "Company name",
    country: "Country (sets currency and language)",
    policyName: "Policy name",
    annualDays: "Days granted per year",
    maxCarryOver: "Carry-over limit",
    isPaid: "Paid",
    requiresApproval: "Approval required",
    inUse: "In use",
    inactive: "Inactive",
    holidayName: "Holiday name",
    categoryName: "Category name",
    newCategoryName: "New category name",
    weekend: "Days off",
  },
  weekdays: {
    sun: "Sun",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
  },
  placeholders: {
    holidayName: "e.g. Lunar New Year holiday",
    categoryName: "e.g. Training",
  },
  actions: {
    savePolicy: "Save policy",
    applyToYear: "Apply granted days to the {year} balances",
    addHoliday: "Add holiday",
    addCategory: "Add category",
    thisYear: "This year",
    yearPrev: "← {year}",
    yearCurrent: "{year}",
    yearNext: "{year} →",
  },
  pending: {
    applying: "Applying...",
    addingHoliday: "Adding...",
    addingCategory: "Adding...",
    deleting: "Deleting...",
  },
  counts: {
    items: "{n}",
    holidays: "{n} in {year}",
    balanceRows: "Balance rows: {n}",
    categoryItems: "Items: {n}",
  },
  hints: {
    applyToYear:
      "Only the granted days of the existing balance rows are updated (used and adjusted days are kept).",
    deleteBlocked: "A category that is in use cannot be deleted",
  },
  empty: {
    holidays: "No public holidays registered for {year}.",
    categories: "No categories registered.",
  },
  a11y: {
    deleteHoliday: "Delete {name}",
  },
  item: {
    holidayLabel: "{date} {name}",
  },
  validation: {
    idRequired: "Please fill in the required details",
    idInvalid: "Those required details are not valid",
    dateRequired: "Please choose a date",
    dateInvalid: "That date is not valid",
    nameTooLong: "{label} must be 100 characters or fewer",
    daysNegative: "{label} must be 0 or more",
    daysTooMany: "{label} must be 365 or fewer",
    valueInvalid: "That value is not valid",
    countryInvalid: "Unsupported country. Choose 대한민국 or 미국.",
    weekendRequired: "Please choose at least one day off",
    weekendAllOff: "At least one day must remain a working day",
    weekendInvalid: "Those days off are not valid",
    noticeTooLong: "The notice must be 500 characters or fewer",
  },
  messages: {
    companySaved: "Company settings saved.",
    mailSaved: "Email alert settings saved.",
    mailSaveFailed: "Could not save. Please try again in a moment.",
    logoSaved: "Company logo saved.",
    logoRemoved: "Company logo removed.",
    logoRequired: "Choose a logo image file.",
    noticeSaved: "Notice saved.",
    transferFailed: "Could not restore. Please try again in a moment.",
    transferFileRequired: "Choose a backup file.",
    transferTooLarge: "File too large (256MB or less).",
    transferBadFile: "Not a backup file.",
    transferVersionMismatch: "Backup from a different version. Upload one made here.",
    transferConfirmRequired: "Check the overwrite confirmation.",
    transferRestored: "Restored.",
    policyNotFound: "That leave policy could not be found.",
    policyNameTaken: "A leave policy with the same name already exists.",
    policySaved: "Leave policy saved ({name}).",
    policyApplySkipped:
      "Nothing was applied because there are no balance rows for {year} (no CSV import and no policy target).",
    policyApplied: "Granted {days} to {rows} for {year}.",
    holidayExists: "That public holiday is already registered.",
    holidayCreated: "Public holiday added.",
    holidayNotFound: "That public holiday could not be found.",
    holidayDeleted: "Public holiday deleted.",
    categoryNameTaken: "That category name already exists.",
    categoryNotFound: "That category could not be found.",
    categoryInUse:
      "The category in use ({name}) cannot be deleted. Deactivate it instead.",
    categoryCreated: "Expense category added.",
    categorySaved: "Expense category saved.",
    categoryDeleted: "Expense category deleted.",
  },
};

/**
 * Copy the settings schema factories read: the field labels they interpolate
 * into messages, the settings-only messages, and the shared "required"
 * template from `common` so it is not duplicated here.
 */
export type SettingsValidationMessages = Pick<
  SettingsMessages,
  "labels" | "validation"
> &
  Pick<CommonMessages["validation"], "required">;
