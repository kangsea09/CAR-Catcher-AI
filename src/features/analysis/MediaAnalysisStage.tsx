import type { CSSProperties, RefObject } from "react";
import { AnalyzingIcon, ScanIcon } from "../../components/Icons";
import type { AnalysisStatus, Vehicle } from "./model";
import { vehicles } from "./model";

type MediaAnalysisStageProps = {
  analysisProgress: number;
  analysisStatus: AnalysisStatus;
  file: File | null;
  inputRef: RefObject<HTMLInputElement | null>;
  isEnhanced: boolean;
  isVideo: boolean;
  mediaUrl: string;
  onVehicleSelect: (index: number) => void;
  selectedVehicle: number;
};

const getBoxStyle = (vehicle: Vehicle): CSSProperties => ({
  left: `${vehicle.box.left}%`,
  top: `${vehicle.box.top}%`,
  width: `${vehicle.box.width}%`,
  height: `${vehicle.box.height}%`,
});

export const MediaAnalysisStage = ({
  analysisProgress,
  analysisStatus,
  file,
  inputRef,
  isEnhanced,
  isVideo,
  mediaUrl,
  onVehicleSelect,
  selectedVehicle,
}: MediaAnalysisStageProps) => (
  <main className="relative flex min-h-[620px] items-center justify-center overflow-hidden bg-[#020a11]">
    {file ? (
      <div className="relative h-full min-h-[620px] w-full overflow-hidden">
        {isVideo ? (
          <video
            className={`absolute inset-0 h-full w-full object-contain transition-[filter] duration-700 ${
              isEnhanced
                ? "brightness-[1.25] contrast-[1.08] saturate-[1.05]"
                : "brightness-[0.72] contrast-[1.12] saturate-[0.7]"
            }`}
            controls
            key={mediaUrl}
            muted
            src={mediaUrl}
          >
            브라우저에서 동영상 재생을 지원하지 않습니다.
          </video>
        ) : (
          <img
            alt="업로드한 수사 자료"
            className={`absolute inset-0 h-full w-full object-contain transition-[filter] duration-700 ${
              isEnhanced
                ? "brightness-[1.25] contrast-[1.08] saturate-[1.05]"
                : "brightness-[0.72] contrast-[1.12] saturate-[0.7]"
            }`}
            src={mediaUrl}
          />
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,15,26,0.3),transparent_18%,transparent_82%,rgba(3,15,26,0.3))]" />
        {analysisStatus === "analyzing" && (
          <div className="analysis-scan-line pointer-events-none absolute inset-x-0 z-10 h-px bg-[#258cff] shadow-[0_0_12px_#1682f5]" />
        )}

        {vehicles.map((vehicle, index) => {
          const active = selectedVehicle === index;
          return (
            <button
              aria-label={`${vehicle.id} ${vehicle.description} 선택`}
              className={`absolute z-20 border text-left transition-all ${
                active
                  ? "border-2 border-[#1687ff] bg-[#0b74df]/5 shadow-[0_0_18px_rgba(22,135,255,0.18)]"
                  : "border border-[#a7c8f4] bg-[#b8d6ff]/5 hover:border-[#1687ff]"
              } disabled:cursor-wait`}
              disabled={analysisStatus !== "complete"}
              key={vehicle.id}
              onClick={() => onVehicleSelect(index)}
              style={getBoxStyle(vehicle)}
              type="button"
            >
              <span
                className={`absolute -top-6 left-[-1px] whitespace-nowrap px-2 py-1 font-mono text-[10px] ${
                  active ? "bg-[#0878ed] text-white" : "bg-[#b8c9e3] text-[#42536a]"
                }`}
              >
                {vehicle.id} [{vehicle.confidence}%]
              </span>
            </button>
          );
        })}

        <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-sm border border-[#29435c] bg-[#071726]/90 px-4 py-2 font-mono text-[10px] tracking-[0.12em] text-[#91a7bf] backdrop-blur">
          {analysisStatus === "analyzing"
            ? "AUTO DETECTION IN PROGRESS"
            : isEnhanced
              ? "ENHANCEMENT APPLIED"
              : "SELECT A VEHICLE TO ENHANCE"}
        </div>

        {analysisStatus === "analyzing" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#020b13]/20 backdrop-blur-[1px]">
            <div
              aria-label={`차량 분석 중 ${analysisProgress}%`}
              aria-live="polite"
              className="relative flex h-48 w-48 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-[#9fc5ff] bg-[#1a2a3e]/95 text-[#b4d0ff] shadow-[0_18px_60px_rgba(0,0,0,0.45),0_0_30px_rgba(55,133,229,0.2)] backdrop-blur-md"
              role="status"
            >
              <div
                className="absolute inset-x-0 bottom-0 bg-[#1c76d2]/15 transition-[height] duration-100"
                style={{ height: `${analysisProgress}%` }}
              />
              <span className="analysis-pulse-icon relative">
                <AnalyzingIcon />
              </span>
              <span className="relative mt-3 font-mono text-xs tracking-[0.14em]">
                분석 중 ...
              </span>
              <span className="relative mt-1 font-mono text-sm font-semibold text-[#d2e3ff]">
                {analysisProgress}%
              </span>
              <div className="relative mt-4 h-1 w-28 overflow-hidden rounded-full bg-[#31455e]">
                <div
                  className="h-full rounded-full bg-[#5ba4ff] transition-[width] duration-100"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="flex max-w-md flex-col items-center px-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[#263e53] bg-[#0b1c2b] text-[#617890]">
          <ScanIcon />
        </span>
        <h2 className="mt-6 text-xl font-light text-[#c8d5e5]">분석할 자료가 없습니다</h2>
        <p className="mt-3 text-sm leading-6 text-[#76899e]">
          좌측 파일 업로드 영역에서 JPG·PNG 이미지 또는 MP4 동영상을 선택하세요. 파일
          형식을 자동 판별한 뒤 차량 감지를 시작합니다.
        </p>
        <button
          className="mt-6 rounded-sm bg-[#0874df] px-6 py-2.5 text-sm text-white transition-colors hover:bg-[#1387f6]"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          분석 자료 선택
        </button>
      </div>
    )}
  </main>
);
