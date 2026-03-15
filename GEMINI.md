# 📂 Hedge Dochi Project Intelligence & Roadmap

> **시스템 프롬프트:** 너는 Hedge Dochi 프로젝트의 메인 개발 파트너이며, 항상 GEMINI.md의 규칙을 준수해야 한다.
> **주의:** 모든 개발 세션 시작 시 이 문서를 최우선으로 참조하여 맥락을 파악하십시오.

---

## 1. 🏗️ 프로젝트 코어 가이드 (Core Principles)

### [Common] 중앙 제어 (`core.js`)
* **인증:** Firebase Auth 연동 필수.
* **필수 기능:** * `saveProgress`: 모든 `input` 이벤트 시 디바운스 적용 저장, 결과 확정 시 즉시 저장(Flush).
    * `getStepData`: `steps.stepN` 계층 구조에서 데이터 추출.
    * **실시간 환율:** `/api/price?ticker=USDKRW=X` 데이터를 전역 공유 (`initExchangeRate` 선행 필수).

### [Key Steps] 핵심 로직
* **[Step 1] 자산 시뮬레이터:** `(연봉/12 - 월지출)` → `monthlySavings` 자동 계산 및 저장 필수.
* **[Step 3] 투자 성향 진단:** `riskType`(공격투자형 등) 및 `recommendedPortfolio` 확정.
* **[Step 7] 재무 요약 청사진:** * 페르소나(Tier+Risk), 월 저축액, 타겟 차트 시각화.
    * AI 인사이트 생성 (데이터 단위(만원/억) 환산 확인 및 중단 금지).

---

## 2. 💾 데이터 구조 및 저장 규칙

### Firestore 구조 (`simulations/{uid}`)
* `roadmapProgress`: 최고 도달 단계 (Number).
* `steps`: (Map) `step1` ~ `step8` 각 단계별 독립 오브젝트.
* `lastUpdated`: Server Timestamp.

### ⚠️ 저장 및 업데이트 규칙 (CRITICAL)
1. **Partial Update:** 반드시 점(.) 표기법(`FieldPath`)을 사용하여 `steps.stepN` 경로로 업데이트. **(Map 전체 덮어쓰기 절대 금지)**
2. **Double Layer:** `localStorage` + `Firestore` 이중화로 데이터 유실 방지.
3. **Unit Consistency:** 모든 금액 데이터의 단위(만원/억) 환산 로직 통일.

---

## 3. 🧠 개발 회고 (Lessons Learned)

* **비동기 처리:** AI 코멘트 및 계산 로직 실행 전 `Promise.all`로 필요한 모든 데이터(환율 포함) 로딩 확인.
* **필드 매핑:** 데이터 저장 시 반드시 자기 단계(N) 번호 확인.
* **부하 관리:** 입력 필드 실시간 저장 시 디바운스(Debounce) 적용 필수.

---

## 4. 📝 데일리 작업 로그 (Daily Activity Log)

*이 섹션은 세션 종료 시 업데이트하여 일의 연속성을 유지합니다.*

| 날짜 | 작업 내용 (Done) | 다음 단계 (Next Step) | 관련 커밋/참고 |
| :--- | :--- | :--- | :--- |
| 2024-05-22 | GEMINI.md 문서 구조화 및 연속성 시스템 구축 | (여기에 내일 할 일을 적어주세요) | `docs: sync roadmap` |
| 2026-03-15 | 시스템 프롬프트 추가 및 문서 구조 고도화 | 데일리 로그 기반 작업 시작 준비 | `docs: update GEMINI.md structure` |

---

### 🚀 세션 시작 시 Gemini에게 던질 프롬프트
> **"GEMINI.md 파일을 읽어줘. 특히 '4. 데일리 작업 로그'의 마지막 행을 확인해서 내가 어제 어디까지 했는지 파악하고, 오늘 작업을 시작할 준비를 해줘."** -y
