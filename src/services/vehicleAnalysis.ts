import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  Schema,
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

const vehicleSchema = Schema.object({
  properties: {
    summary: Schema.string(),
    vehicles: Schema.array({
      maxItems: 50,
      items: Schema.object({
        properties: {
          id: Schema.string(),
          description: Schema.string(),
          confidence: Schema.number(),
          color: Schema.string(),
          bodyType: Schema.string(),
          box: Schema.object({
            properties: {
              left: Schema.number(),
              top: Schema.number(),
              width: Schema.number(),
              height: Schema.number(),
            },
          }),
          candidates: Schema.array({
            maxItems: 3,
            items: Schema.object({
              properties: {
                name: Schema.string(),
                confidence: Schema.number(),
              },
            }),
          }),
          evidence: Schema.array({
            maxItems: 6,
            items: Schema.string(),
          }),
        },
      }),
    }),
  },
});

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

const createModel = (useResponseSchema = true) => {
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
      ...(useResponseSchema ? { responseSchema: vehicleSchema } : {}),
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
    evidence: (vehicle.evidence ?? []).filter(Boolean).slice(0, 6),
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
- 차종을 확신할 수 없으면 낮은 신뢰도를 사용하고 단정하지 마세요.
- evidence에는 헤드램프, 그릴, 휠, 루프라인, C필러처럼 화면에서 직접 관찰 가능한 근거만 작성하세요.
- 번호판 문자나 사람의 신원을 식별하지 마세요.
- 설명과 근거는 한국어로 작성하세요.
- 반드시 설명문이나 마크다운 없이 아래 구조의 JSON 객체만 반환하세요.
- {"summary":"분석 요약","vehicles":[{"id":"VEH_01","description":"차량 설명","confidence":0,"color":"색상","bodyType":"차체 유형","box":{"left":0,"top":0,"width":0,"height":0},"candidates":[{"name":"예상 차종","confidence":0}],"evidence":["판단 근거"]}]}
`;

const isInvalidArgumentError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid_argument") ||
    normalized.includes("invalid argument") ||
    normalized.includes("400")
  );
};

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
  let result;
  try {
    result = await model.generateContent([prompt, ...parts]);
  } catch (error) {
    if (!isInvalidArgumentError(error)) throw error;

    onProgress({ progress: 72, stage: "gemini-analysis" });
    const fallbackModel = createModel(false);
    result = await fallbackModel.generateContent([prompt, ...parts]);
  }

  onProgress({ progress: 96, stage: "response-validation" });
  const parsed = JSON.parse(result.response.text()) as AnalysisResult;
  const normalized = normalizeResult(parsed);

  onProgress({ progress: 100, stage: "complete" });
  return normalized;
};
