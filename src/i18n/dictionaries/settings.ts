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
        "회사명과 시간대를 지정합니다. 시간대는 근태·휴가 화면의 날짜 기준입니다.",
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
  },
  labels: {
    companyName: "회사명",
    timezone: "시간대 (표시 기준)",
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
    timezoneRequired: "시간대를 선택하세요",
    timezoneInvalid: "시간대가 올바르지 않습니다",
    unknownTimezone: "알 수 없는 시간대입니다.",
  },
  messages: {
    companySaved: "회사 설정이 저장되었습니다.",
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
        "Set the company name and timezone. The timezone is the date basis for the attendance and leave screens.",
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
  },
  labels: {
    companyName: "Company name",
    timezone: "Timezone (display basis)",
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
    timezoneRequired: "Please choose a timezone",
    timezoneInvalid: "That timezone is not valid",
    unknownTimezone: "That timezone is not recognised.",
  },
  messages: {
    companySaved: "Company settings saved.",
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
