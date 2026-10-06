/**
 * Expense module copy. See common.ts for strings shared across modules
 * (e.g. decide / validation / expenseStatus used on the page badge).
 */

export const expensesKo = {
  page: {
    title: "경비",
    subtitle: "비용 신청서 작성 · 승인 · 지급 확인",
    exportCsv: "이번 달 CSV 내보내기",
  },
  /**
   * Status labels written into the downloaded CSV. Richer than the compact
   * badge labels in common.expenseStatus; the export route falls back to
   * common.expenseStatus for any status not listed here.
   */
  sections: {
    newReport: "새 경비 신청서",
    newReportHint: "제출 전까지 삭제가 가능합니다. 제출 후 승인/반려 처리됩니다.",
    myReports: "내 경비 신청서",
    noReports: "신청 내역이 없습니다.",
    items: "항목",
    noItemsCannotSubmit: "항목이 없으면 제출할 수 없습니다.",
    rejectReason: "반려 사유: {comment}",
    comment: "의견: {comment}",
    inbox: "승인 대기 경비 ({count})",
    payQueue: "지급 대기 (승인됨) ({count})",
  },
  form: {
    title: "제목",
    titlePlaceholder: "예: 9월 교통비 정산",
    periodStart: "기간 시작",
    periodEnd: "기간 종료",
    category: "카테고리",
    amountLabel: "금액 (USD)",
    description: "설명",
    descriptionPlaceholder: "예: 서울 강남 → 판교 택시",
    receiptOptional: "영수증 (선택)",
    addItem: "+ 항목 추가",
    createReport: "신청서 작성",
    submitForApproval: "승인 요청",
  },
  decide: {
    commentPlaceholder: "승인/반려 의견 (반려 시 필수)",
    payCommentPlaceholder: "지급 메모 (선택)",
    confirmPay: "지급 확정",
  },
  receipt: {
    link: "영수증: {filename}",
  },
  messages: {
    noItems: "항목을 하나 이상 추가하세요.",
    maxItems: "항목은 최대 {max}개까지 입력할 수 있습니다.",
    itemError: "항목 {n} 오류: {error}",
    checkValue: "값을 확인하세요",
    itemAmountPositive: "항목 {n} 오류: 금액은 0보다 커야 합니다",
    periodInvalid: "기간이 올바르지 않습니다.",
    invalidCategory: "유효하지 않은 카테고리가 포함되어 있습니다.",
    saveError: "저장 중 오류가 발생했습니다. 다시 시도해주세요.",
    reportCreated: "경비 신청서가 작성되었습니다.",
    reportInvalid: "보고서 정보가 올바르지 않습니다.",
    cannotSubmit: "제출할 수 없는 보고서입니다.",
    noItemsToSubmit: "항목이 없는 보고서는 제출할 수 없습니다.",
    requestSubmitted: "승인 요청이 제출되었습니다.",
    cannotDelete: "삭제할 수 없는 보고서입니다.",
    reportDeleted: "보고서가 삭제되었습니다.",
    invalidDecision: "결정 값이 올바르지 않습니다.",
    payAdminOnly: "결제 확정은 관리자만 할 수 있습니다.",
    payConfirmed: "결제가 확정되었습니다.",
  },
  /**
   * Equivalents of the Korean error strings src/lib/storage.ts returns. The
   * expense action maps storage's literal errors onto these keys so receipt
   * upload errors render in the user's language (storage.ts is not edited).
   */
  receiptErrors: {
    empty: "빈 파일입니다.",
    tooLarge: "파일은 5MB 이하만 올릴 수 있습니다.",
    unsupportedType: "지원 형식: JPEG, PNG, WEBP, PDF",
  },
  validation: {
    titleRequired: "제목을 입력하세요",
    titleTooLong: "제목은 100자 이내입니다",
    startDateRequired: "시작 날짜를 선택하세요",
    endDateRequired: "종료 날짜를 선택하세요",
    dateRequired: "날짜를 선택하세요",
    categoryRequired: "카테고리를 선택하세요",
    amountInvalid: "금액 형식이 올바르지 않습니다",
    descriptionTooLong: "설명은 200자 이내입니다",
  },
  export: {
    columns: {
      date: "날짜",
      category: "카테고리",
      employee: "직원",
      title: "제목",
      status: "상태",
      amount: "금액",
      currency: "통화",
      description: "설명",
      receipts: "영수증",
    },
  },
};

export type ExpenseMessages = typeof expensesKo;

export const expensesEn: ExpenseMessages = {
  page: {
    title: "Expenses",
    subtitle: "Create, approve and pay expense reports",
    exportCsv: "Export this month's CSV",
  },
  sections: {
    newReport: "New expense report",
    newReportHint:
      "You can delete this until you submit. After submission it is approved or rejected.",
    myReports: "My expense reports",
    noReports: "No reports yet.",
    items: "Items",
    noItemsCannotSubmit: "A report with no items cannot be submitted.",
    rejectReason: "Rejection reason: {comment}",
    comment: "Comment: {comment}",
    inbox: "Expenses awaiting approval ({count})",
    payQueue: "Awaiting payment (approved) ({count})",
  },
  form: {
    title: "Title",
    titlePlaceholder: "e.g. September transport settlement",
    periodStart: "Period start",
    periodEnd: "Period end",
    category: "Category",
    amountLabel: "Amount (USD)",
    description: "Description",
    descriptionPlaceholder: "e.g. Gangnam → Pangyo taxi",
    receiptOptional: "Receipt (optional)",
    addItem: "+ Add item",
    createReport: "Create report",
    submitForApproval: "Submit for approval",
  },
  decide: {
    commentPlaceholder: "Comment (required when rejecting)",
    payCommentPlaceholder: "Payment note (optional)",
    confirmPay: "Confirm payment",
  },
  receipt: {
    link: "Receipt: {filename}",
  },
  messages: {
    noItems: "Please add at least one item.",
    maxItems: "You can enter up to {max} item(s).",
    itemError: "Item {n} error: {error}",
    checkValue: "Please check the value.",
    itemAmountPositive: "Item {n} error: the amount must be greater than 0.",
    periodInvalid: "The period is not valid.",
    invalidCategory: "The report contains an invalid category.",
    saveError: "An error occurred while saving. Please try again.",
    reportCreated: "Your expense report has been created.",
    reportInvalid: "The report information is not valid.",
    cannotSubmit: "This report cannot be submitted.",
    noItemsToSubmit: "A report with no items cannot be submitted.",
    requestSubmitted: "Your approval request has been submitted.",
    cannotDelete: "This report cannot be deleted.",
    reportDeleted: "The report has been deleted.",
    invalidDecision: "The decision value is not valid.",
    payAdminOnly: "Only an administrator can confirm payment.",
    payConfirmed: "Payment has been confirmed.",
  },
  receiptErrors: {
    empty: "The file is empty.",
    tooLarge: "Files must be 5MB or smaller.",
    unsupportedType: "Supported formats: JPEG, PNG, WEBP, PDF",
  },
  validation: {
    titleRequired: "Please enter a title",
    titleTooLong: "The title must be 100 characters or fewer",
    startDateRequired: "Please select a start date",
    endDateRequired: "Please select an end date",
    dateRequired: "Please select a date",
    categoryRequired: "Please choose a category",
    amountInvalid: "The amount format is not valid",
    descriptionTooLong: "The description must be 200 characters or fewer",
  },
  export: {
    columns: {
      date: "Date",
      category: "Category",
      employee: "Employee",
      title: "Title",
      status: "Status",
      amount: "Amount",
      currency: "Currency",
      description: "Description",
      receipts: "Receipts",
    },
  },
};

/** Validation copy the expense schema factories need. */
export type ExpenseValidationMessages = Pick<
  ExpenseMessages,
  "validation"
>;