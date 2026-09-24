# UX 사전조사 보고서 — 기존 툴들의 메뉴/워크플로 분석

> 목적: hr-app(20명용 근태+휴가+경비 툴) 설계 전, 이미 검증된 UX 패턴을 취합해 참고 기준으로 삼는다.
> 조사 대상: 오픈소스(Frappe HR, OpenHRApp, DutyDuke, Receipt Wrangler, open-expense, CogniClaim) + 유료(BambooHR, Gusto, Rippling, Expensify, SAP Concur)

---

## 1. 내비게이션 (메뉴 구조) 비교

### 1.1. 두 가지 화면 철학: "관리자용" vs "직원용"
- **Frappe HR**: 관리자/매니저는 **모듈 데스크** (9개 모듈 + 좌측 사이드바), 직원은 **모바일 자가서비스 앱** (하단 탭 5개: Home/Attendance/Leaves/Expenses/Salary). **같은 데이터를 두 화면이 공유** → 신청/승인 워크플로가 정확히 일치.
- **open-expense**: 한 화면 안에서 **태스크 기반 뷰 스위처** "Submit / Process"로 전환. 역할 이름이 아니라 **일 이름**으로 UI 분리 → "역할을 여러 개 가진 소규모 팀"에 유리.
- **결론(우리 프로젝트)**: 20명 규모에선 open-expense식 "직원 화면 + 관리 화면" 또는 Frappe식 "모바일 탭 + 데스크 모듈" 중 선택. 정답은 **직원은 간단한 화면, 매니저/관리자는 전용 대시보드**.

### 1.2. 참고 내비게이션 실제 예시
| 툴 | 내비 형태 | 1차 메뉴 |
|---|---|---|
| BambooHR | 상단 탭바 | Home, My Info, People, Hiring, Time Off, Reports, Files |
| Gusto | 좌측 사이드바 | Payroll, People, Hiring, Time & Attendance(Time off 포함), Benefits |
| Rippling | 홈=앱 타일 런처 | Pay, People, Time, Expenses, Benefits, Devices… |
| Expensify | 5개 탭 | Home, Inbox, Spend, Workspaces, Account |
| SAP Concur | 상단 메뉴바 | Home, Requests, Travel, Expense, Approvals, Reporting |
| Frappe HR | 모듈별 사이드바 | (Shift&Attendance, Leaves, Expenses 등 9모듈) |
| OpenHRApp | 역할별 필터 사이드바 | Dashboard, My Attendance, Attendance Audit, Leave, Team, Org, Reports, Settings |

**공통 원칙:**
1. 각 도메인(근태/휴가/경비/승인)이 **1차 메뉴 항목**으로 등장
2. **대시보드/홈이 "지금 나한테 필요한 것"을 먼저 보여줌** (승인 대기, 예정 휴가, 미제출 보고서)
3. Frappe의 "module 사이드바 뼈대" (Home → Dashboard → 주요 문서 → Reports → Setup)가 구조 학습 비용을 낮춤

---

## 2. 휴가(PTO) 워크플로 — 업계 표준

### 2.1. 신청 흐름 (전 툴 공통)
```
[직원] 신청 폼 열기
  → 유형 선택 + 기간 선택
  → [실시간 계산] 근무일수/잔여일/이번 신청이 차감할 양 표시   ← 핵심 패턴
  → 사유 입력 → 제출
[알림] 매니저에게 이메일 + 인앱 배지
[매니저] 승인 대기 큐에서 1클릭 승인 (반려 시 사유 필수 입력)
  → 승인 화면에 직원의 현재 잔여일도 함께 표시                  ← 핵심 패턴
[알림] 직원에게 결과 이메일 (승인자 코멘트 포함)
[캘린더] 팀 캘린더에 반영 (대기 중 요청은 회색으로 표시)         ← 핵심 패턴
```

### 2.2. 잔여일 표현 (참고 디자인)
- **Frappe**: 카드마다 반원 도넛 + `잔여/지급` (예: `12/20`)
- **Gusto**: 신청 폼 안에 `현재잔여 / 다른대기신청시간 / 이번신청차감량` **3층 분해** — 최고의 혼동방지 패턴
- **BambooHR**: `Accruals / Balance History / Requests` 세 개 서브테이블 + 잔여일 계산기
- **Rippling**: 휴가 코드별 밸런스 + 공휴일 자동 반영 타임카드
- **DutyDuke**: 상태 필터칩 (Pending/Approved/Rejected)

### 2.3. 상태값 (대부분 동일한 파이프라인)
`Requested → Approved/Denied/Canceled` (+ Superseded: 승인된 걸 수정 시 재신청)
- **잔여일 차감 시점**: 최종 승인 시 (OpenHRApp은 "승인됐지만 Pending HR이면 아직 확정 아님" 가이드 텍스트 제공)
- **중복 신청 보호**: 같은 날짜 이중 신청 차단 (Gusto는 API 422 + UI 가드)

---

## 3. 근태 워크플로

| 툴 | 방식 | 특징 |
|---|---|---|
| Frappe HR | 단일 버튼 체크인/아웃 (마지막 로그 기준 토글) | 확인 시트에 타임스탬프+지오로케이션, Off-Shift 표시, 미체크 경고 배너 |
| OpenHRApp | **전체화면 펀치 페이지** (의무유형 선택→셀카→GPS) | 같은 날 여러 펀치는 1개 레코드로 통합(가장 이른 IN, 늦은 OUT), 크론 자동 클로즈 |
| BambooHR | 홈 위젯에서 바로 클록인/아웃 | 키오스크(태블릿), 얼굴인식, 아이디+PIN |
| Gusto | 홈 타일 클록인 → 역할 선택 → 클록인 | 브레이크(식사/휴식) 분리, 수동입력 시 메모 필수 |
| Rippling | GPS 반경(지오펜스) 내에서만 펀치 | 알림: 놓친 펀치/오버타임 위험/조기 퇴근 경고 |

**공통 패턴:**
1. **체크인/아웃 = 최우선 속도 UI** (전용 페이지 or 홈 고정 위젯, 1클릭)
2. 누락 보정: **수정 요청 → 매니저 승인** 워크플로 (Frappe의 Attendance Request)
3. 관리자용 **월간 근태 시트**: 일별 그리드 + 요약(Present/Absent/Leave/Holidays/Unmarked/Late)
4. 미체크/미종결은 **크론+경고 배너**로 자동 처리

---

## 4. 경비 청구 워크플로 — Expensify/Concur가 정점

### 4.1. 업계 베스트 (Expensify 스캔 중심)
```
[캡처] 사진 촬영 / 이메일 forward(receipts@) / 업로드 (30장 멀티)
  → [OCR] 거래처·날짜·금액·통화·카테고리 자동 추출
  → [자동 매칭] 카드 거래와 매칭, 실시간 중복/불일치 탐지     ← Rippling도 동일
[리뷰] 자동채움 필드 수정 (신뢰도 낮은 필드는 노란색 하이라이트)   ← CogniClaim 패턴
[리포트] 항목들이 자동으로 보고서에 쌓임 (Auto-Report)
[제출] → 상태: Draft → Submitted → Approved → Paid
  (화면마다 "다음 해야 할 1가지" 초록 버튼이 컨텍스트에 맞춰 바뀜)
[승인] 채팅/큐에서 승인, 반려 시 사유 필수, 부분승인 금액조정 가능
[지급] ACH/급여에 묶어 지급 (승인된 것만 지급)
```

### 4.2. SAP Concur 독특 패턴 (링크만 따올 것)
- **`+ New` 퀵액션 바**: 신청/경비/영수증 업로드 바로가기
- **탭별 카운트 배지 승인 워크리스트**: "카운트를 0으로 만들기"가 작업 지침
- **Approval Flow 시각화**: 보고서에 누가 언제 승인했는지 경로 표시
- **`Available Expenses` 인박스**: 캡처했지만 아직 보고서에 안 담긴 항목을 잃지 않게 유지

### 4.3. 상태 파이프라인 비교
| 툴 | 파이프라인 |
|---|---|
| Expensify | Draft → Outstanding → Approved → Paid → Done |
| Concur | Open → Submitted → Approved → Paid |
| open-expense | draft → submitted → received(UI표시: "Validated") |
| Receipt Wrangler | Draft → Open → Resolved (+ Needs Attention) |
| CogniClaim | submit → approve/reject (감사 타임라인) |

---

## 5. 공통 패턴 종합 (전 툴에서 반복 확인된 10가지)

1. **모듈 단위 내비 + 1차 메뉴에 도메인 배치** — 근태/휴가/경비/승인이 최상위
2. **대시보드= "지금 나에게 필요한 것" 집계** — 승인 대기 수, 미제출, 오늘 쉬는 사람
3. **승인 큐 = 탭/칩 + 카운트 배지 + 1클릭 승인 + 반려 시 사유필수**
4. **신청 폼 내 실시간 계산** — 잔여일 분해(Gusto 3층)를 신청 전에 표시
5. **승인자 화면에도 직원 잔여일 노출**
6. **"누가 쉬는지" 팀 캘린더 + 대기 중 요청은 회색 표시 (바로 승인 가능)**
7. **명시적 상태 파이프라인** — 칩/배지로 색상 구분, 파이널 스테이드에서만 잔여차감/지급 확정
8. **캡처가 최고속도 UI** — 체크인 1클릭, 영수증은 사진/이메일로 즉시
9. **알림 = 이메일 + 인앱** — 승인 시 딥링크 포함, 결정 코멘트가 신청자에게 전달
10. **인간 오류 방지를 UX로 코딩** — 승인 후 수정불가(다시 신청), 중복 날짜 차단, 감사 타임라인 남기기

---

## 6. 우리 프로젝트 설계 시사점

### 6.1. 내비게이션 초안 (hr-app)
```
[직원 화면]
  홈 : 오늘 출근 상태, 잔여휴가 카드, 나의 최근 신청/승인 상태
  근태 : 체크인/아웃 버튼, 월간 기록
  휴가 : 신청, 잔여일, 나의 내역, "누가 쉬는지" 캘린더
  경비 : 청구서 작성(영수증 첨부), 나의 청구 내역

[관리자/매니저 화면 - 좌측 사이드바]
  대시보드        : 승인 대기/월별 요약/팀 캘린더
  승인 큐         : 휴가·경비·근태수정 탭별 카운트 배지 ("work to zero")
  근태           : 월간 근태 시트, 수정 승인
  직원           : 프로필, 초대, 비활성화
  설정           : 휴가정책/공휴일/카테고리/회사정보
```

### 6.2. 상태 파이프라인 (hr-app)
```
휴가   : 신청 → 승인대기 → 승인/반려 (+ 취소)
경비   : 초안 → 제출 → 승인(위원회) → 지급확정 / 반려   [부분승인은 MVP에서 제외]
근태   : 기록 → 수정요청 → 승인/반려
```

### 6.3. MVP에 반드시 넣을 패턴 (가치대비 비용 최고)
1. ✅ 승인 큐 + 카운트 배지 + 1클릭 승인 + 반려 시 사유필수
2. ✅ 신청 폼 안 잔여일 3층 분해(Gusto) + 승인자 화면에도 잔여일
3. ✅ 팀 캘린더 "누가 쉬는지" + 대기 신청 회색 표시
4. ✅ 영수증 업로드 → 상태 파이프라인(Draft→Submitted→Approved→Paid)
5. ✅ 실시간 근무일 계산 (주말/공휴일 제외, 날짜 선택하면서 표시)
6. ✅ 이메일 알림 + 딥링크, 반려 코멘트 전달

### 6.4. v0.2+ 후보 (우선순위)
1. 영수증 OCR (AI) — Expensify식 캡처 → 자동추출 → 신뢰도 낮은 필드 강조
2. PWA 모바일 + 오프라인 초안 (IndexedDB)
3. GPS 출퇴근 (선택)
4. iCal 팀 캘린더 연동, CSV/PDF 내보내기

### 6.5. 피해야 할 안티패턴 (실제 리뷰에서 확인됨)
- 영수증 촬영까지 4클릭 (Rippling) → 캡처는 최대 1-2 동작
- 기본값이 잘못된 급여주기 (Rippling) → 날짜 기본값 = 오늘
- 도움말 검색 시 재로그인 강요 (Rippling) → 요구사항상 불필요
- 복잡한 내비/클릭 수 많음 (Concur 구UI) → 20명 툴은 단순함이 곧 경쟁력

---

## 7. 참고 소스 목록
- Frappe HR: https://github.com/frappe/hrms / docs.frappe.io/hr
- OpenHRApp: https://github.com/mimnets/OpenHRApp
- DutyDuke: https://github.com/Bitnoise/dutyduke
- Receipt Wrangler: https://github.com/Receipt-Wrangler/receipt-wrangler
- open-expense: https://github.com/yipfram/open-expense
- CogniClaim: https://github.com/ShindeSid/CogniClaim
- 비교분석: BambooHR/Gusto/Rippling (2026 가격·기능), Expensify·SAP Concur 도움말/제품문서