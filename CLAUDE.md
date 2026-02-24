# SnapEstate - AI 건물 분석 서비스

## 프로젝트 개요
건물 사진을 촬영하면 AI가 건물 정보, 실거래가, 투자 분석을 제공하는 한국 부동산 분석 웹앱.

## 기술 스택
- **Frontend**: React 18 + Vite, TailwindCSS, Framer Motion, TanStack React Query
- **Backend**: Base44 SDK (로우코드 백엔드), Deno 서버 함수 (`functions/`)
- **지도**: React-Leaflet, Nominatim (역 지오코딩)
- **UI**: Radix UI 기반 shadcn/ui 컴포넌트, Lucide 아이콘
- **언어**: 한국어 UI, date-fns/ko 로케일

## 프로젝트 구조

```
src/
  pages/Home.jsx          # 메인(유일한) 페이지 - 분석 UI 전체
  hooks/useAnalysis.js    # 핵심 비즈니스 로직 (분석 파이프라인 오케스트레이션)
  components/building/    # 도메인 컴포넌트
    AnalysisResult.jsx    # 분석 결과 표시
    ImageUploader.jsx     # 이미지 업로드 + EXIF GPS 추출
    MapView.jsx           # Leaflet 지도
    InvestmentScore.jsx   # 투자 점수 (0-100) 시각화
    RentalAnalysis.jsx    # 임대 수익 분석
    RecentAnalyses.jsx    # 최근 분석 기록 (검색/펼치기)
    ZoningInfo.jsx        # 용도지역 정보
    EditableField.jsx     # 인라인 편집 필드
  components/ui/          # shadcn/ui (수정 불필요)
  utils/format.js         # 공유 포맷 유틸 (가격, 면적 등)
  lib/                    # 인프라 (AuthContext, query-client 등)
  api/base44Client.js     # Base44 SDK 클라이언트

functions/
  searchCommercialPrice.ts  # DB 실거래가 검색 (CommercialTransaction 엔티티)
  getRealEstatePrice.ts     # 국토교통부 공공 API 실거래가 조회
  getImageLocation.ts       # 이미지 EXIF GPS → 주소 변환
  backfillRealPrices.ts     # 관리자용 배치 업데이트
```

## 핵심 아키텍처

### 실거래가 조회 파이프라인 (3-tier fallback)
1. **DB 검색** (`searchCommercialPrice.ts`): CommercialTransaction 엔티티에서 주소 매칭
2. **국토교통부 API** (`getRealEstatePrice.ts`): DB에 없으면 공공 API로 조회
3. **AI 추정**: 둘 다 실패시 LLM이 시세 추정

### 주소 매칭 알고리즘 (`searchCommercialPrice.ts`)
- 도로명 매칭(120점), 지번 정확 매칭(120점), 지번 본번 매칭(80점), 동 매칭(50점)
- `hasJibunOrRoad` 여부에 따라 최소 점수 기준 동적 조정 (80점 vs 50점)
- `getJibunCandidates()`: 도로명 주소 필드 제외하여 건물번호 오인 방지

### 국토교통부 API (`getRealEstatePrice.ts`)
- `SIGUNGU_ENTRIES` 튜플 배열로 시군구 코드 관리 (JS 객체 중복키 문제 해결)
- `CITY_ALIASES`로 도시명 정규화
- 최근 24개월 역순 검색 + 200건 이상시 조기 종료 (타임아웃 방지)

### 분석 흐름 (`useAnalysis.js`)
1. 이미지 업로드 → EXIF GPS 추출 또는 수동 주소 입력
2. Nominatim 역 지오코딩 → 한국어 주소 조합
3. LLM 건물 분석 (건물 종류, 연식, 면적, 가격 추정, 투자 점수, 임대 분석)
4. 실거래가 조회 (DB → 국토부 API → AI 추정)
5. 결과 합성 및 표시

## 개발 컨벤션

### 커밋 스타일
- 영어 커밋 메시지, 한글 코멘트/UI
- 변경 요약 1줄 + 상세 bullet points

### 코드 스타일
- ESLint: `src/components/**`, `src/pages/**` 대상 (ui/, lib/ 제외)
- 미사용 import 자동 제거 (`eslint-plugin-unused-imports`)
- 경로 별칭: `@/*` → `./src/*`

### 주의사항
- `src/components/ui/` 는 shadcn/ui 생성 파일 → 직접 수정 지양
- `src/lib/`, `src/api/` 는 Base44 SDK 인프라 → 직접 수정 지양
- `functions/` 는 Deno 런타임 (npm: prefix import)
- 빌드 환경 없음 (node/npm 미설치) → 코드 리뷰로 검증

## 완료된 작업 이력

### 긴급 (commit b763b74)
- 인증 수정, 에러 핸들링, 단계별 진행률, Nominatim API, EXIF 파서 재작성, 파일 크기 검증

### 높음 (commit 8434c45)
- useAnalysis.js 훅 추출, 공유 포맷 유틸, Home.jsx 리팩토링, 한국어 UI, date-fns 마이그레이션, 미사용 의존성 13개 제거

### 중간 (commit a2bb805)
- 모바일 바텀시트 UX, 접근성(ARIA), 병렬 LLM 호출

### 실거래가 검색 버그 수정 (commit 1bb9d3e)
- Nominatim jibunAddress에 houseNumber 포함
- 동 전용 매칭 (지번 번호 없는 경우) 0점 문제 해결
- 도로명 주소 fallback 차단 해제
- getRealEstatePrice fallback 연결 (3가지 검색 경로 모두)

### 국토부 API 및 매칭 개선 (commit f7c9f3b)
- getRealEstatePrice: 240+ 월 순회 → 24개월 역순 검색 (타임아웃 해결)
- SIGUNGU_ENTRIES 튜플 배열 (중구/서구 등 중복키 해결)
- 지번 매칭 스코어링 시스템 추가
- getJibunCandidates: 도로명대지위치_표제부 필드 제외

### 낮음 이슈 (commit 6686a83)
- InvestmentScore + RentalAnalysis 컴포넌트 연결 (LLM 스키마 + Home.jsx)
- Web Share API + 클립보드 fallback 공유 버튼
- RecentAnalyses 개선 (검색, 펼치기/접기, 주소 표시)
