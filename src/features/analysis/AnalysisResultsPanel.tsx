import { analysisReasons, candidates, vehicles } from "./model";
import type { AnalysisStatus } from "./model";

type AnalysisResultsPanelProps = {
  analysisProgress: number;
  analysisStatus: AnalysisStatus;
  file: File | null;
  isEnhanced: boolean;
  isVideo: boolean;
  mediaUrl: string;
  onRestart: () => void;
  selectedVehicle: number;
};

export const AnalysisResultsPanel = ({
  analysisProgress,
  analysisStatus,
  file,
  isEnhanced,
  isVideo,
  mediaUrl,
  onRestart,
  selectedVehicle,
}: AnalysisResultsPanelProps) => {
  const selected = vehicles[selectedVehicle];

  return (
    <aside className="border-l border-[#25394b] bg-[#0d1d2d] p-6 xl:h-screen xl:overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#d5dfed]">AI 분석</h2>
        <span className="rounded border border-[#2b4b68] px-2 py-1 font-mono text-[9px] tracking-[0.13em] text-[#79a8db]">
          {analysisStatus === "analyzing"
            ? `ANALYZING ${analysisProgress}%`
            : analysisStatus === "complete"
              ? "ANALYSIS COMPLETE"
              : "AUTO DETECTION"}
        </span>
      </div>

      <section className="mt-6">
        <p className="font-mono text-[10px] tracking-[0.14em] text-[#9cabc0]">
          ENHANCED DETAIL
        </p>
        <div className="relative mt-3 aspect-[2.2/1] overflow-hidden border border-[#2e4357] bg-[#081521] p-1">
          {file ? (
            isVideo ? (
              <video
                className={`h-full w-full object-cover transition-[filter] duration-700 ${
                  isEnhanced ? "brightness-125 contrast-110" : "brightness-75 contrast-125"
                }`}
                key={`detail-${mediaUrl}`}
                muted
                src={mediaUrl}
              />
            ) : (
              <img
                alt={`${selected.id} 보정 상세`}
                className={`h-full w-full object-cover transition-[filter] duration-700 ${
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
              FILTER: {isEnhanced ? "SHARPEN_V2" : "RAW_FRAME"}
            </span>
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
          <span className="font-mono text-[10px] text-[#66819f]">{selected.id}</span>
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
