import type { AnalysisResult, Vehicle } from "../features/analysis/model";

type AnalysisProgressHandler = (progress: {
  progress: number;
  stage: string;
}) => void;

const LOCAL_API_URL = (
  import.meta.env.VITE_LOCAL_AI_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const clamp = (value: unknown, minimum: number, maximum: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.min(maximum, Math.max(minimum, numeric))
    : minimum;
};

const normalizeConfidence = (value: unknown) =>
  Math.round(clamp(value, 0, 100));

const normalizeVehicle = (vehicle: Vehicle, index: number): Vehicle => {
  const left = clamp(vehicle.box?.left, 0, 99);
  const top = clamp(vehicle.box?.top, 0, 99);

  return {
    id: vehicle.id?.trim() || `VEH_${String(index + 1).padStart(2, "0")}`,
    description: vehicle.description?.trim() || "감지된 차량",
    confidence: normalizeConfidence(vehicle.confidence),
    color: vehicle.color?.trim() || "판별 불가",
    bodyType: vehicle.bodyType?.trim() || "판별 불가",
    usageType: vehicle.usageType?.trim() || "용도 미상",
    usageConfidence: normalizeConfidence(vehicle.usageConfidence),
    usageReliable: vehicle.usageReliable,
    bodyCrossCheck: vehicle.bodyCrossCheck
      ? {
          available: Boolean(vehicle.bodyCrossCheck.available),
          name: vehicle.bodyCrossCheck.name?.trim(),
          confidence: normalizeConfidence(vehicle.bodyCrossCheck.confidence),
          reliable: Boolean(vehicle.bodyCrossCheck.reliable),
        }
      : undefined,
    inspectionStages: (vehicle.inspectionStages ?? []).slice(0, 4),
    box: {
      left,
      top,
      width: clamp(vehicle.box?.width, 1, 100 - left),
      height: clamp(vehicle.box?.height, 1, 100 - top),
    },
    candidates: (vehicle.candidates ?? []).slice(0, 3).map((candidate) => ({
      name: candidate.name?.trim() || "분류 불가",
      confidence: normalizeConfidence(candidate.confidence),
    })),
    evidence: (vehicle.evidence ?? []).filter(Boolean).slice(0, 10),
    productReliable: vehicle.productReliable,
    referenceImage: vehicle.referenceImage,
  };
};

const parseError = async (response: Response) => {
  try {
    const payload = (await response.json()) as { detail?: string };
    if (payload.detail) return payload.detail;
  } catch {
    // The local server may have returned a non-JSON proxy error.
  }
  return `로컬 분석 서버 오류 (${response.status})`;
};

export const analyzeVehicleMedia = async (
  file: File,
  onProgress: AnalysisProgressHandler,
): Promise<AnalysisResult> => {
  onProgress({ progress: 8, stage: "decode" });
  const formData = new FormData();
  formData.append("file", file, file.name);

  onProgress({ progress: 20, stage: "request-package" });
  let response: Response;
  try {
    onProgress({ progress: 32, stage: "local-analysis" });
    response = await fetch(`${LOCAL_API_URL}/api/analyze`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw new Error(
      `로컬 분석 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요. (${error instanceof Error ? error.message : String(error)})`,
      { cause: error },
    );
  }

  if (!response.ok) throw new Error(await parseError(response));

  onProgress({ progress: 94, stage: "response-validation" });
  const raw = (await response.json()) as AnalysisResult;
  const normalized: AnalysisResult = {
    summary: raw.summary?.trim() || "로컬 차량 분석이 완료되었습니다.",
    vehicles: (raw.vehicles ?? []).map(normalizeVehicle),
    enhancedImage: raw.enhancedImage,
  };

  onProgress({ progress: 100, stage: "complete" });
  return normalized;
};
