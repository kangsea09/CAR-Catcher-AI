import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
} from "firebase/ai";
import type { AnalysisResult, Vehicle } from "../features/analysis/model";
import {
  prepareMediaForAnalysis,
  type PreparedMedia,
  type ProcessingProgress,
} from "./mediaProcessor";

type AnalysisProgressHandler = (progress: {
  progress: number;
  stage: string;
}) => void;

type InlineDataPart = {
  inlineData: {
    data: string;
    mimeType: string;
  };
};

const requiredFirebaseConfig = () => {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  if (!config.apiKey || !config.projectId || !config.appId) {
    throw new Error(
      "Firebase 연결 설정이 없습니다. .env.local에 VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID를 입력하세요.",
    );
  }

  return config;
};

let appCheckInitialized = false;

const createModel = () => {
  const app =
    getApps().length > 0 ? getApp() : initializeApp(requiredFirebaseConfig());
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  const configuredDebugToken =
    import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?.trim();
  const shouldUseDebugToken =
    import.meta.env.DEV &&
    import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG === "true";

  // AI Logic may initialize App Check from the project's remote config.
  // Enable debug mode before getAI(), even when no local site key is present.
  if (shouldUseDebugToken) {
    (
      globalThis as typeof globalThis & {
        FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
      }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = configuredDebugToken || true;
  }

  if (siteKey && !appCheckInitialized) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitialized = true;
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: import.meta.env.VITE_GEMINI_MODEL || "gemini-3.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.15,
    },
  });
};

const blobToPart = async (media: PreparedMedia): Promise<InlineDataPart> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error(`${media.label} 파일을 읽지 못했습니다.`));
    reader.readAsDataURL(media.blob);
  });

  return {
    inlineData: {
      data: dataUrl.split(",")[1],
      mimeType: media.mimeType,
    },
  };
};

const clamp = (value: unknown, minimum: number, maximum: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.min(maximum, Math.max(minimum, numeric))
    : minimum;
};

const normalizeConfidence = (value: unknown) => {
  const numeric = Number(value);
  const percentage =
    Number.isFinite(numeric) && numeric > 0 && numeric <= 1
      ? numeric * 100
      : numeric;
  return Math.round(clamp(percentage, 0, 100));
};

const normalizeVehicle = (vehicle: Vehicle, index: number): Vehicle => {
  const left = clamp(vehicle.box?.left, 0, 99);
  const top = clamp(vehicle.box?.top, 0, 99);

  return {
    id: vehicle.id?.trim() || `VEH_${String(index + 1).padStart(2, "0")}`,
    description: vehicle.description?.trim() || "감지된 차량",
    confidence: normalizeConfidence(vehicle.confidence),
    color: vehicle.color?.trim() || "판별 불가",
    bodyType: vehicle.bodyType?.trim() || "판별 불가",
    box: {
      left,
      top,
      width: clamp(vehicle.box?.width, 1, 100 - left),
      height: clamp(vehicle.box?.height, 1, 100 - top),
    },
    candidates: (vehicle.candidates ?? []).slice(0, 3).map((candidate) => ({
      name: candidate.name?.trim() || "알 수 없는 차종",
      confidence: normalizeConfidence(candidate.confidence),
    })),
    evidence: (vehicle.evidence ?? []).filter(Boolean).slice(0, 8),
  };
};

const normalizeResult = (rawResult: AnalysisResult): AnalysisResult => ({
  summary: rawResult.summary?.trim() || "차량 분석이 완료되었습니다.",
  vehicles: (rawResult.vehicles ?? []).map(normalizeVehicle),
});

const buildPrompt = (processingNote: string, media: PreparedMedia[]) => `
당신은 CCTV 차량 분석 보조 시스템입니다.

입력 미디어 순서:
${media.map((item, index) => `${index + 1}. ${item.label}`).join("\n")}

전처리 정보:
${processingNote}

요구 사항:
- 화면에 실제로 보이는 모든 차량만 탐지하세요.
- 보정 과정에서 발생한 경계, 잔상, 샤프닝 노이즈를 차량 특징으로 판단하지 마세요.
- 각 차량의 box는 전체 화면 기준 퍼센트 좌표로 반환하세요.
- left와 top은 좌상단 위치, width와 height는 크기이며 모두 0~100 범위입니다.
- box는 차량의 범퍼, 지붕, 좌우 차체, 보이는 사이드미러와 바퀴가 잘리지 않도록 차량 전체 외곽을 감싸세요.
- 차량 외곽에 약 2%의 여백만 두고 도로, 인도, 건물 또는 다른 차량을 불필요하게 포함하지 마세요.
- box를 반환하기 전에 좌우 및 상하 경계가 실제 차량 외곽과 맞는지 다시 확인하세요.
- confidence는 해당 물체가 차량이라는 0~100 범위의 신뢰도이며 0~1 소수로 반환하지 마세요.
- candidates에는 예상 제조사와 차종명을 합친 이름과 신뢰도를 최대 3개 반환하세요.
- 각 차량은 후보를 정하기 전에 아래 순서를 반드시 지켜 독립적으로 관찰하세요.
  1. 로고: 위치, 형상, 엠블럼 윤곽을 확인하되 흐리거나 가려졌다면 추측하지 마세요.
  2. 범퍼: 공기 흡입구, 장식선, 보호대와 모서리 형상을 확인하세요.
  3. 헤드램프: 외곽 형태, 내부 그래픽, 주간주행등의 배치를 확인하세요.
  4. 라디에이터 그릴: 윤곽, 크기, 패턴, 분할 구조와 헤드램프와의 연결 방식을 확인하세요.
  5. 루프: 루프라인, 높이, 경사, 루프랙과 파노라마 루프 유무를 확인하세요.
  6. 포그 램프(안개등): 위치, 하우징 형태와 범퍼 내 배치를 확인하세요.
  7. 에어덕트: 위치, 크기, 윤곽, 분할 형태, 핀과 장식 구조 및 범퍼·그릴과의 연결 방식을 확인하세요.
  8. 전체 외관: 차체 비율, 실루엣, 필러, 휠아치, 측면 캐릭터 라인과 후면 형상을 종합하세요.
- evidence에는 위 8개 항목을 같은 순서로 정확히 8개 작성하고, 각 문자열을 "로고:", "범퍼:", "헤드램프:", "라디에이터 그릴:", "루프:", "포그 램프:", "에어덕트:", "전체 외관:"으로 시작하세요.
- 화면에서 확인할 수 없는 항목은 특징을 만들어내지 말고 해당 항목에 "관찰 불가"와 그 이유를 작성하세요.
- 차종 후보는 한 가지 특징만으로 결정하지 말고, 8단계에서 관찰한 특징들의 일치점과 충돌점을 함께 비교하여 정하세요.
- 로고가 흐리거나 보이지 않으면 차체 디자인 특징을 우선하고, 연식·트림을 구분할 근거가 부족하면 제조사와 모델 수준까지만 답하세요.
- 후보 신뢰도는 관찰 가능한 식별 특징의 수, 특징의 고유성, 영상 품질과 후보 간 충돌을 반영하세요. 확신할 수 없으면 낮은 신뢰도를 사용하고 단정하지 마세요.
- 번호판 문자나 사람의 신원을 식별하지 마세요.
- 설명과 근거는 한국어로 작성하세요.
- 반드시 설명문이나 마크다운 없이 아래 구조의 JSON 객체만 반환하세요.
- {"summary":"분석 요약","vehicles":[{"id":"VEH_01","description":"차량 설명","confidence":0,"color":"색상","bodyType":"차체 유형","box":{"left":0,"top":0,"width":0,"height":0},"candidates":[{"name":"예상 차종","confidence":0}],"evidence":["로고: 관찰 내용","범퍼: 관찰 내용","헤드램프: 관찰 내용","라디에이터 그릴: 관찰 내용","루프: 관찰 내용","포그 램프: 관찰 내용","에어덕트: 관찰 내용","전체 외관: 관찰 내용"]}]}
`;

const mapProcessingProgress = (
  update: ProcessingProgress,
  onProgress: AnalysisProgressHandler,
) => {
  onProgress({
    progress: update.progress,
    stage: update.stage,
  });
};

export const analyzeVehicleMedia = async (
  file: File,
  onProgress: AnalysisProgressHandler,
): Promise<AnalysisResult> => {
  const model = createModel();
  const prepared = await prepareMediaForAnalysis(file, (update) =>
    mapProcessingProgress(update, onProgress),
  );

  onProgress({ progress: 58, stage: "request-package" });
  const parts: InlineDataPart[] = [];
  for (let index = 0; index < prepared.media.length; index += 1) {
    parts.push(await blobToPart(prepared.media[index]));
    onProgress({
      progress: 58 + Math.round(((index + 1) / prepared.media.length) * 7),
      stage: "request-package",
    });
  }

  onProgress({ progress: 68, stage: "gemini-analysis" });
  const prompt = buildPrompt(prepared.processingNote, prepared.media);
  const result = await model.generateContent([prompt, ...parts]);

  onProgress({ progress: 96, stage: "response-validation" });
  const parsed = JSON.parse(result.response.text()) as AnalysisResult;
  const normalized = normalizeResult(parsed);

  onProgress({ progress: 100, stage: "complete" });
  return normalized;
};
