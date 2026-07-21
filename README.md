# CAR-Catcher AI

JPG, PNG 또는 MP4 수사 자료에서 차량을 감지하고 예상 차종과 판단 근거를 제공하는
React 기반 분석 UI입니다.

## 실행

```bash
npm install
npm run dev
```

## Gemini 연결

이 프로젝트는 Gemini API 키를 브라우저 번들에 직접 포함하지 않습니다. 서버를 직접
운영하지 않으면서 키를 보호하기 위해 Firebase AI Logic과 Firebase App Check를
사용합니다.

1. Firebase Console에서 프로젝트와 Web 앱을 생성합니다.
2. `AI Services > AI Logic > Get started`에서 Gemini Developer API를 선택합니다.
3. `Security > App Check`에서 Web 앱과 reCAPTCHA Enterprise를 등록하고 Firebase AI
   Logic 적용을 강제합니다.
4. `.env.example`을 `.env.local`로 복사하고 Firebase Web 설정값과 App Check Site
   Key를 입력합니다.
5. 로컬 개발에서는 콘솔에 출력된 App Check Debug Token을 Firebase Console에
   등록합니다.

```bash
Copy-Item .env.example .env.local
```

`VITE_FIREBASE_API_KEY`는 Firebase Web 설정용 공개 식별자입니다. Google AI Studio에서
발급한 Gemini API 키를 `.env.local`이나 React 코드에 입력하지 마세요.

## 분석 파이프라인

- 이미지: 크기 최적화 → 톤 매핑 → 샤프닝 기반 디블러링 → 원본·보정본 분석
- 동영상: 대표 프레임 추출 → 연속 5프레임 전역 흔들림 정렬 및 평균 합성 →
  톤 매핑·디블러링 → 원본 또는 대표 프레임 분석
- Gemini: 구조화 JSON으로 차량 위치, 색상, 차체 유형, Top-3 차종과 판단 근거 반환

동영상이 인라인 요청 제한에 가까우면 원본 동영상 대신 대표 프레임과 합성 프레임만
전송합니다.

## 검사

```bash
npm run build
npm run lint
```
