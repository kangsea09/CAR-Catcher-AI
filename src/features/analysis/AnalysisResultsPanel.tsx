import { useEffect, useRef } from "react";
import type { AnalysisStatus, Vehicle } from "./model";

type VehicleCropProps = {
  sourceUrl: string;
  vehicle: Vehicle;
};

const VehicleCrop = ({ sourceUrl, vehicle }: VehicleCropProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceUrl) return;

    const source = new Image();
    source.onload = () => {
      const context = canvas.getContext("2d");
      if (!context) return;

      const sourceX = (vehicle.box.left / 100) * source.naturalWidth;
      const sourceY = (vehicle.box.top / 100) * source.naturalHeight;
      const sourceWidth = Math.max(1, (vehicle.box.width / 100) * source.naturalWidth);
      const sourceHeight = Math.max(1, (vehicle.box.height / 100) * source.naturalHeight);
      canvas.width = Math.max(1, Math.round(sourceWidth));
      canvas.height = Math.max(1, Math.round(sourceHeight));
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        source,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    };
    source.src = sourceUrl;

    return () => {
      source.onload = null;
    };
  }, [sourceUrl, vehicle]);

  return (
    <canvas
      aria-label={`${vehicle.id} 선택 차량 원본 영역`}
      className="block h-full w-full"
      ref={canvasRef}
      role="img"
    />
  );
};

type AnalysisResultsPanelProps = {
  analysisProgress: number;
  analysisStatus: AnalysisStatus;
  enhancedMediaUrl: string;
  file: File | null;
  isEnhanced: boolean;
  isVideo: boolean;
  mediaUrl: string;
  onRestart: () => void;
  selectedVehicle: number;
  vehicles: Vehicle[];
};

export const AnalysisResultsPanel = ({
  analysisProgress,
  analysisStatus,
  enhancedMediaUrl,
  file,
  isEnhanced,
  isVideo,
  mediaUrl,
  onRestart,
  selectedVehicle,
  vehicles,
}: AnalysisResultsPanelProps) => {
  const selected = vehicles[selectedVehicle];
  const candidates = selected?.candidates ?? [];
  const analysisReasons = selected?.evidence ?? [];
  const inspectionStages = selected?.inspectionStages?.length
    ? selected.inspectionStages
    : [
        { key: "logo", label: "로고", visible: false },
        { key: "bumper", label: "범퍼", visible: false },
        { key: "headlights", label: "헤드라이트", visible: false },
        { key: "exterior", label: "전체 외관", visible: false },
      ];

  return (
    <aside className="border-l border-[#25394b] bg-[#0d1d2d] p-6 xl:h-screen xl:overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#d5dfed]">로컬 AI 분석</h2>
        <span className="rounded border border-[#2b4b68] px-2 py-1 font-mono text-[9px] tracking-[0.13em] text-[#79a8db]">
          {analysisStatus === "analyzing"
            ? `ANALYZING ${analysisProgress}%`
            : analysisStatus === "complete"
              ? "ANALYSIS COMPLETE"
              : analysisStatus === "error"
                ? "ANALYSIS FAILED"
                : "AUTO DETECTION"}
        </span>
      </div>

      <section className="mt-6">
        <p className="font-mono text-[10px] tracking-[0.14em] text-[#9cabc0]">
          TOP-1 VEHICLE REFERENCE
        </p>
        <div
          className="relative mt-3 overflow-hidden border border-[#2e4357] bg-[#081521] p-1"
          style={{
            aspectRatio:
              selected && !selected.referenceImage
                ? `${selected.box.width} / ${selected.box.height}`
                : "4 / 3",
          }}
        >
          {file ? (
            selected?.referenceImage ? (
              <img
                alt={`${selected.candidates[0]?.name ?? "예상 차량"} 웹 참고 사진`}
                className="h-full w-full object-contain"
                onError={(event) => {
                  if (enhancedMediaUrl && event.currentTarget.src !== enhancedMediaUrl) {
                    event.currentTarget.src = enhancedMediaUrl;
                  }
                }}
                src={selected.referenceImage.url}
              />
            ) : selected && (enhancedMediaUrl || (!isVideo && mediaUrl)) ? (
              <VehicleCrop
                sourceUrl={enhancedMediaUrl || mediaUrl}
                vehicle={selected}
              />
            ) : isEnhanced && enhancedMediaUrl ? (
              <img
                alt="로컬 복원 프레임"
                className="h-full w-full object-contain"
                src={enhancedMediaUrl}
              />
            ) : isVideo ? (
              <video
                className={`h-full w-full object-contain transition-[filter] duration-700 ${
                  isEnhanced ? "brightness-125 contrast-110" : "brightness-75 contrast-125"
                }`}
                key={`detail-${mediaUrl}`}
                muted
                src={mediaUrl}
              />
            ) : (
              <img
                alt={`${selected?.id ?? "선택 차량"} 보정 상세`}
                className={`h-full w-full object-contain transition-[filter] duration-700 ${
                  isEnhanced ? "brightness-125 contrast-110" : "brightness-75 contrast-125"
                }`}
                src={mediaUrl}
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.12em] text-[#52677d]">
              NO SOURCE MEDIA
            </div>
          )}
          {file && (
            <span className="absolute bottom-3 left-3 border border-[#6c8eb2] bg-[#0b1c2d]/90 px-2 py-1 font-mono text-[9px] text-[#b8d4f3]">
              {selected?.referenceImage
                ? "REFERENCE: TOP-1 MATCH"
                : selected
                  ? "SOURCE: SELECTED VEHICLE"
                : `FILTER: ${isEnhanced ? "LOCAL_RESTORE" : "RAW_FRAME"}`}
            </span>
          )}
          {selected?.referenceImage && (
            <a
              className="absolute bottom-3 right-3 max-w-[48%] truncate border border-[#6c8eb2] bg-[#0b1c2d]/90 px-2 py-1 font-mono text-[9px] text-[#b8d4f3] hover:text-white"
              href={selected.referenceImage.sourceUrl}
              rel="noreferrer"
              target="_blank"
              title={selected.referenceImage.title}
            >
              SOURCE: WIKIMEDIA
            </a>
          )}
        </div>
      </section>

      <section className="mt-7">
        <h3 className="font-mono text-[11px] tracking-[0.1em] text-[#aab8ca]">분석 카테고리</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Tone Mapping", "Frame Fusion", "Local Detection"].map((category) => (
            <span
              className="rounded-full border border-[#3c6188] bg-[#14263b] px-3 py-1 font-mono text-[11px] tracking-[0.04em] text-[#a9c8ee]"
              key={category}
            >
              {category}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-7 grid grid-cols-2 gap-3">
        <div className="border border-[#283d50] bg-[#101f30] p-3">
          <p className="font-mono text-[9px] tracking-[0.12em] text-[#66819f]">
            차체 종류
          </p>
          <p className="mt-2 text-sm text-[#d1dbe8]">
            {selected?.bodyType ?? "대기 중"}
          </p>
          <p className="mt-1 text-[10px] text-[#71869c]">
            {selected?.bodyCrossCheck?.available
              ? `전용 모델 ${selected.bodyCrossCheck.confidence ?? 0}%`
              : "기본 탐지 모델"}
          </p>
        </div>
        <div className="border border-[#283d50] bg-[#101f30] p-3">
          <p className="font-mono text-[9px] tracking-[0.12em] text-[#66819f]">
            운행 용도
          </p>
          <p className="mt-2 text-sm text-[#d1dbe8]">
            {selected?.usageType ?? "용도 미상"}
          </p>
          <p className="mt-1 text-[10px] text-[#71869c]">
            {selected?.usageType === "택시 추정"
              ? `표시등 단서 ${selected.usageConfidence ?? 0}%`
              : "전용 학습 데이터 필요"}
          </p>
        </div>
      </section>

      <section className="mt-7">
        <h3 className="font-mono text-[11px] tracking-[0.1em] text-[#aab8ca]">
          제품명 확인 순서
        </h3>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {inspectionStages.map((stage, index) => (
            <div
              className={`border px-2 py-3 text-center ${
                stage.visible
                  ? "border-[#2e6fa8] bg-[#112942] text-[#b8d8f7]"
                  : "border-[#293a4a] bg-[#0d1925] text-[#5f7184]"
              }`}
              key={stage.key}
            >
              <p className="font-mono text-[9px] text-[#66819f]">0{index + 1}</p>
              <p className="mt-1 text-[11px]">{stage.label}</p>
              <p className="mt-1 font-mono text-[8px]">
                {stage.visible ? "확인" : "건너뜀"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[11px] tracking-[0.1em] text-[#aab8ca]">
            {selected?.productReliable === false
              ? "낮은 신뢰도 후보 Top-3"
              : "예상 차량 제품명 Top-3"}
          </h3>
          <span className="font-mono text-[10px] text-[#66819f]">
            {selected?.id ?? "WAITING"}
          </span>
        </div>
        <div className="mt-4 space-y-4">
          {candidates.map((candidate, index) => (
            <div key={candidate.name}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-[#c3cedd]">
                  {index + 1}. {candidate.name}
                </span>
                <span className="font-mono text-[#a7bad1]">{candidate.confidence}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[#2b3b4b]">
                <div
                  className={`h-full rounded-full ${
                    index === 0 ? "bg-[#087be9]" : "bg-[#526477]"
                  }`}
                  style={{ width: `${candidate.confidence}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 border border-[#283d50] bg-[#101f30] p-4">
        <h3 className="font-mono text-[11px] tracking-[0.1em] text-[#aab8ca]">
          로컬 모델 판단 근거
        </h3>
        <ul className="mt-3 space-y-3 text-xs leading-5 text-[#93a3b7]">
          {analysisReasons.map((reason) => (
            <li className="flex gap-2" key={reason}>
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#3189e7]" />
              {reason}
            </li>
          ))}
        </ul>
      </section>

      <button
        className="mt-6 w-full bg-[#0873dc] py-3 text-sm text-white transition-colors hover:bg-[#1286f4] disabled:cursor-not-allowed disabled:bg-[#29435b] disabled:text-[#71869a]"
        disabled={!file || analysisStatus === "analyzing"}
        onClick={onRestart}
        type="button"
      >
        {analysisStatus === "analyzing"
          ? `분석 중... ${analysisProgress}%`
          : "다시 분석하기"}
      </button>
    </aside>
  );
};
