import { useEffect, useRef, useState } from "react";
import type { AnalysisStatus, Vehicle } from "./model";
import {
  lookupVehicleReference,
  type VehicleReference,
} from "../../services/vehicleReference";

type VehicleCropProps = {
  isVideo: boolean;
  sourceUrl: string;
  vehicle: Vehicle;
};

const VehicleCrop = ({ isVideo, sourceUrl, vehicle }: VehicleCropProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isVideo) return;
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
      canvas.width = Math.round(sourceWidth);
      canvas.height = Math.round(sourceHeight);
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
  }, [isVideo, sourceUrl, vehicle]);

  if (isVideo) {
    return (
      <video
        className="absolute max-w-none"
        muted
        src={sourceUrl}
        style={{
          height: `${10000 / vehicle.box.height}%`,
          left: `${(-vehicle.box.left / vehicle.box.width) * 100}%`,
          top: `${(-vehicle.box.top / vehicle.box.height) * 100}%`,
          width: `${10000 / vehicle.box.width}%`,
        }}
      />
    );
  }

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
  file,
  isVideo,
  mediaUrl,
  onRestart,
  selectedVehicle,
  vehicles,
}: AnalysisResultsPanelProps) => {
  const selected = vehicles[selectedVehicle];
  const candidates = selected?.candidates ?? [];
  const analysisReasons = selected?.evidence ?? [];
  const topCandidateName = candidates[0]?.name ?? "";
  const [referenceState, setReferenceState] = useState<{
    candidateName: string;
    reference: VehicleReference | null;
    resolved: boolean;
  }>({ candidateName: "", reference: null, resolved: false });
  const reference =
    referenceState.candidateName === topCandidateName
      ? referenceState.reference
      : null;
  const referenceResolved =
    !topCandidateName ||
    (referenceState.candidateName === topCandidateName && referenceState.resolved);

  useEffect(() => {
    const controller = new AbortController();
    if (!topCandidateName) return () => controller.abort();
    void lookupVehicleReference(topCandidateName, controller.signal)
      .then((result) => {
        setReferenceState({
          candidateName: topCandidateName,
          reference: result,
          resolved: true,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setReferenceState({
          candidateName: topCandidateName,
          reference: null,
          resolved: true,
        });
      });
    return () => controller.abort();
  }, [topCandidateName]);

  return (
    <aside className="border-l border-[#25394b] bg-[#0d1d2d] p-6 xl:h-screen xl:overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#d5dfed]">AI 분석</h2>
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
            aspectRatio: reference
              ? "4 / 3"
              : selected
                ? `${selected.box.width} / ${selected.box.height}`
                : "4 / 3",
          }}
        >
          {file ? (
            reference ? (
              <a
                aria-label={`${topCandidateName} Wikimedia 출처 페이지 열기`}
                className="block h-full w-full cursor-pointer"
                href={reference.sourceUrl}
                rel="noreferrer"
                target="_blank"
                title={`${reference.title} 출처 페이지 열기`}
              >
                <img
                  alt={`${topCandidateName} 참고 사진`}
                  className="h-full w-full object-contain"
                  onError={() => {
                    setReferenceState({
                      candidateName: topCandidateName,
                      reference: null,
                      resolved: true,
                    });
                  }}
                  src={reference.url}
                />
              </a>
            ) : selected && referenceResolved ? (
              <VehicleCrop isVideo={isVideo} sourceUrl={mediaUrl} vehicle={selected} />
            ) : (
              <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.12em] text-[#52677d]">
                SEARCHING TOP-1 PHOTO
              </div>
            )
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-[10px] tracking-[0.12em] text-[#52677d]">
              NO SOURCE MEDIA
            </div>
          )}
          {file && (
            <span className="absolute bottom-3 left-3 border border-[#6c8eb2] bg-[#0b1c2d]/90 px-2 py-1 font-mono text-[9px] text-[#b8d4f3]">
              {reference ? "REFERENCE: TOP-1 MATCH" : "SOURCE: SELECTED VEHICLE"}
            </span>
          )}
          {reference && (
            <a
              className="absolute bottom-3 right-3 max-w-[48%] truncate border border-[#6c8eb2] bg-[#0b1c2d]/90 px-2 py-1 font-mono text-[9px] text-[#b8d4f3] hover:text-white"
              href={reference.sourceUrl}
              rel="noreferrer"
              target="_blank"
              title={reference.title}
            >
              SOURCE: WIKIMEDIA
            </a>
          )}
        </div>
      </section>

      <section className="mt-7">
        <h3 className="font-mono text-[11px] tracking-[0.1em] text-[#aab8ca]">분석 카테고리</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Headlight Pattern", "Wheel Geometry", "C-Pillar Curve"].map((category) => (
            <span
              className="rounded-full border border-[#3c6188] bg-[#14263b] px-3 py-1 font-mono text-[11px] tracking-[0.04em] text-[#a9c8ee]"
              key={category}
            >
              {category}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-[11px] tracking-[0.1em] text-[#aab8ca]">
            Top-3 예상 차종
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
          AI 세부 판단 근거
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
