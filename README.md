# CAR-Catcher AI

> **야간/저화질 CCTV 및 블랙박스 기반 다중 차량 자동 감지 및 AI 정밀 식별 서비스**

---

## 프로젝트 소개 (Project Overview)

**CAR-Catcher AI**는 야간이나 저화질 환경의 CCTV/블랙박스(사진 및 동영상) 자료에서 화면 내 존재하는 모든 차량을 자동 감지하고, 수사관/관제사가 원하는 특정 차량을 원클릭으로 정밀 분석하여 **차종**을 즉시 제공하는 웹 서비스입니다.

---

## 핵심 기능 (Key Features)

- **통합 매체 업로드 (Multi-Format Support)**
  - 사진(`.jpg`, `.png`) 및 동영상(`.mp4`) 파일 모두 대응
- **다중 차량 자동 감지 (Auto Detection)**
  - 화면 내 존재하는 여러 대의 차량을 식별하여 리스트화
- **원클릭 정밀 분석 (One-Click Analysis)**
  - 특정 차량 선택 시 Top-3 예상 차종, 신뢰도(%), 세부 특징(헤드램프, 휠, C필러 등) 카드 출력
- **시각적 보정 연출 (Visual Enhancement)**
  - CSS 이미지 필터 기반의 Before/After 화질 보정 연출 뷰 제공

---

## 기술 스택 (Tech Stack)

- **Frontend:** React (Vite), JavaScript
- **AI Engine:** Google Gemini 1.5 Flash API
- **Deployment:** Vercel
