# Hedge Dochi Project Intelligence & Roadmap

이 문서는 Hedge Dochi 서비스의 기능 명세, 데이터 구조, 개발 이력 및 오류 방지 가이드를 담고 있습니다. 모든 개발 세션 시작 시 이 문서를 최우선으로 참조하여 맥락을 파악해야 합니다.

---

## 1. 페이지별 주요 기능 및 프로세스

### [Common] 중앙 제어 (`core.js`)
- **인증:** Firebase Auth (Google Login).
- **진척도 관리:** `userProgress` (1~8단계) 및 `localStorage` 캐싱.
- **데이터 저장:** `saveProgress(stepId, data)`를 통해 Firestore `simulations` 컬렉션에 단계별 데이터 격리 저장.
- **연결 플랫폼:** Firebase Firestore, Firebase Auth.

### [Step 1] 자산 시뮬레이터 (`step1-asset.js`)
- **기능:** 10년 후 예상 자산 등급 시뮬레이션.
- **핵심 로직:** 복리 계산식, 자산 티어링(브론즈~다이아몬드).
- **필수 프로세스:** 입력값 변경 시 `autoSaveData` 호출.

### [Step 2] 은퇴 설계 (`step2-fire.html/js`)
- **기능:** FIRE(Early Retirement) 가능 시점 계산.
- **핵심 로직:** 4% 법칙 기반 인출 전략 및 목표 자산 도달 기간 계산.

### [Step 3] 투자 성향 진단 (`step3-risk.js`)
- **기능:** 7가지 문항을 통한 투자 심리 및 성향 분석.
- **핵심 로직:** 점수 합산에 따른 5가지 투자 유형 분류.
- **필수 프로세스:** 완료 시 `userProgress`를 4단계(가이드)로 강제 업데이트.

### [Step 4] 금융 지식 허브 (`step4-guide.html`)
- **기능:** 투자 기초 이론(MPT, 자산배분, 리밸런싱 등) 교육 가이드.

### [Step 5] 전략 선택 (`step5-models.html`)
- **기능:** 대가들의 포트폴리오(올웨더, 60/40, 영구 포트폴리오) 선택.
- **필수 프로세스:** 전략 선택 시 `userProgress`를 6단계로 업데이트.

### [Step 6] 수익 시뮬레이션 (`step6-simulate.js`)
- **기능:** 배당 및 적립식 복리 수익 구체적 계산.

### [Step 7] 메인 대시보드 (`step7-dashboard.js`)
- **기능:** 전체 단계 데이터 종합 표시, 포트폴리오 건강 점수, 실시간 시장 지수.
- **연결:** `/api/price` (실시간 티커 조회).

### [Step 8] 리밸런싱 도구 (`step8-rebalance.js`)
- **기능:** 실전 포트폴리오 등록 및 목표 비중 대비 리밸런싱 계산.
- **연결:** `/api/search` (티커 검색), `/api/price` (실시간 가격).

---

## 2. 서비스 흐름 및 데이터 구조

### 전체 흐름도
1. `index.html` (진척도 확인 및 이어하기)
2. `Step 1~3` (데이터 입력 및 진단)
3. `Step 4~6` (학습 및 전략 수립)
4. `Step 7~8` (실전 관리 및 대시보드)

### 저장 정보 (Firestore: `simulations/{uid}`)
- `roadmapProgress`: 현재 진행 단계 (Number)
- `steps`: 단계별 상세 데이터 오브젝트 (Map)
  - `step1`: { salary, seed, baseCurrency, ... }
  - `step2`: { monthlyExpense, annualSave, ... }
  - `...`
- `lastUpdated`: 최종 수정 시간

### 플랫폼 키 및 설정
- **Firebase Project ID:** `hedge-dochi`
- **API Endpoints:** `/api/price?ticker=...`, `/api/search?q=...`

---

## 3. 개발 회고 및 오류 방지 (Lessons Learned)

### ⚠️ 과거 발생한 주요 오류 및 해결책
1. **휘발성 세션 문제:** `sessionStorage` 사용 시 브라우저 닫기 시 데이터 유실. ➔ **해결:** `localStorage`로 교체하여 영구 보존.
2. **비동기 레이스 컨디션:** Firebase 인증 완료 전 UI 렌더링으로 진척도 초기화 현상. ➔ **해결:** `localStorage` 우선 로드 후 Firebase 동기화 (`coreDataReady` 이벤트 기반).
3. **진척도 ID 불일치:** N단계 완료 시 진척도를 N으로 저장하여 재방문 시 이전 단계로 돌아가는 문제. ➔ **해결:** **N단계 완료 시점에는 반드시 N+1을 `saveProgress`의 stepId로 전달**해야 함.
4. **저장 시점 지연:** '다음' 버튼 클릭 시에만 저장하여 중도 이탈 시 데이터 유실. ➔ **해결:** 모든 `input` 요소에 `change` 리스너를 달아 **실시간 자동 저장(`autoSaveData`)** 적용.
5. **대시보드 데이터 연계 누락 (Step 7):** `getStepData` 호출 시 비동기 처리가 누락되거나, 중첩된 필드(`steps.stepX`) 접근 시 데이터 유무 체크 부족으로 정보 미표시. ➔ **해결:** 모든 외부 단계 데이터 로딩 시 `await`를 명시하고, UI 렌더링 전 데이터 존재 여부를 엄격히 검증함.
6. **Step ID 데이터 매핑 실수 (Step 1~6):** 단계를 완료하고 다음 단계로 넘길 때 `saveProgress(N+1, data)`를 호출하여, N단계 데이터가 N+1 필드에 저장되는 심각한 매핑 오류 발생. ➔ **해결:** **데이터 저장은 항상 현재 단계 ID(N)를 사용**하고, 진척도 숫자(Number) 업데이트는 별도의 네비게이션 로직(`goToNextStep`)에서 처리하도록 규칙화함.

### 💡 향후 개발 시 주의사항
- 새로운 단계를 추가할 때 `core.js`의 `ROADMAP_STEPS` 배열에 등록하고, 해당 페이지 하단에 `autoSaveData` 로직이 있는지 확인하십시오.
- 모든 스텝 JS 파일은 `type="module"`로 로드되므로, 전역 함수 사용 시 `window.functionName` 형식을 유지하십시오.
- 대시보드(`Step 7`) 수정 시 `steps.step1` 등 중첩된 데이터 구조를 참조하고 있는지 확인하십시오.

---
*이 문서는 개발 세션이 거듭됨에 따라 지속적으로 업데이트됩니다.*
