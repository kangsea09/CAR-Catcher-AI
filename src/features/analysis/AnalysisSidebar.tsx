import type { ChangeEvent, RefObject } from "react";
import { BackIcon, ScanIcon, UploadIcon } from "../../components/Icons";
import { SUPPORTED_MEDIA_ACCEPT } from "../../lib/media";
import type { AnalysisStatus, Vehicle } from "./model";

type AnalysisSidebarProps = {
  analysisProgress: number;
  analysisStatus: AnalysisStatus;
  file: File | null;
  inputRef: RefObject<HTMLInputElement | null>;
  isVideo: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onHome: () => void;
  onVehicleSelect: (index: number) => void;
  selectedVehicle: number;
  vehicles: Vehicle[];
};

export const AnalysisSidebar = ({
  analysisProgress,
  analysisStatus,
  file,
  inputRef,
  isVideo,
  onFileChange,
  onHome,
  onVehicleSelect,
  selectedVehicle,
  vehicles,
}: AnalysisSidebarProps) => (
  <aside className="flex min-h-0 flex-col border-r border-[#24384a] bg-[#0d1d2d] xl:h-screen">
    <div className="border-b border-[#26394b] p-6">
      <div className="flex items-center justify-between gap-3">
        <button
          className="text-left text-xl font-semibold tracking-[-0.02em] text-[#d7e2f1] transition-colors hover:text-white"
          onClick={onHome}
          type="button"
        >
          CAR-Catcher AI
        </button>
        <button
          aria-label="새 수사 자료 화면으로 돌아가기"
          className="flex h-8 w-8 items-center justify-center rounded border border-[#2d4257] text-[#8293aa] transition-colors hover:border-[#4d6985] hover:text-white"
          onClick={onHome}
          type="button"
        >
          <BackIcon />
        </button>
      </div>

      <input
        accept={SUPPORTED_MEDIA_ACCEPT}
        className="sr-only"
        onChange={onFileChange}
        ref={inputRef}
        type="file"
      />
      <button
        className="mt-5 flex min-h-[120px] w-full flex-col items-center justify-center border-2 border-dashed border-[#405166] bg-[#0b1a29] px-4 text-center transition-colors hover:border-[#66809c] hover:bg-[#102337]"
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <span className="text-[#76869c]">
          <UploadIcon className="h-6 w-6" />
        </span>
        <span className="mt-2 text-sm text-[#c0cbda]">
          {file ? "분석 자료 변경" : "파일 업로드"}
        </span>
        <span className="mt-1 max-w-full truncate font-mono text-xs text-[#7e8ca0]">
          {file ? file.name : "Supported: .jpg, .png, .mp4"}
        </span>
        {file && (
          <span className="mt-2 font-mono text-[10px] tracking-[0.12em] text-[#5f98d1]">
            {isVideo ? "VIDEO SCAN MODE" : "IMAGE SCAN MODE"}
          </span>
        )}
      </button>
    </div>

    <div className="analysis-vehicle-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm text-[#c5cfdd]">감지된 차량</h2>
        <span className="font-mono text-[10px] tracking-[0.12em] text-[#6d8197]">
          {analysisStatus === "analyzing"
            ? `SCANNING ${analysisProgress}%`
            : analysisStatus === "error"
              ? "FAILED"
              : file
              ? `${vehicles.length} DETECTED`
              : "WAITING"}
        </span>
      </div>

      {file && vehicles.length > 0 ? (
        <div className="space-y-3">
          {vehicles.map((vehicle, index) => {
            const active = selectedVehicle === index;
            return (
              <button
                aria-pressed={active}
                className={`w-full border p-3 text-left transition-all ${
                  active
                    ? "border-[#78aef5] bg-[#17283c] shadow-[inset_3px_0_0_#0878ed]"
                    : "border-[#293e52] bg-[#142436] hover:border-[#4f6983] hover:bg-[#192c41]"
                } disabled:cursor-wait disabled:opacity-55`}
                disabled={analysisStatus !== "complete"}
                key={vehicle.id}
                onClick={() => onVehicleSelect(index)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm text-[#cbd8eb]">{vehicle.id}</span>
                  <span
                    className={`rounded-sm px-1.5 py-0.5 font-mono text-xs ${
                      active
                        ? "bg-[#234b80] text-[#b9d7ff]"
                        : "bg-[#263a4e] text-[#a9b5c7]"
                    }`}
                  >
                    {vehicle.confidence}%
                  </span>
                </div>
                <p className="mt-1.5 truncate text-sm text-[#aeb9ca]">
                  {vehicle.description}
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-52 flex-col items-center justify-center border border-dashed border-[#25394b] bg-[#0a1927] px-6 text-center">
          <span className="text-[#52677d]">
            <ScanIcon />
          </span>
          <p className="mt-3 text-sm leading-6 text-[#728398]">
            JPG, PNG 또는 MP4 자료를 업로드하면
            <br />
            차량을 자동 감지합니다.
          </p>
        </div>
      )}
    </div>

    <div className="flex h-12 shrink-0 items-center justify-between border-t border-[#26394b] px-5 font-mono text-[10px] tracking-[0.1em] text-[#74859a]">
      <span>
        AI_ENGINE:{" "}
        {analysisStatus === "analyzing"
          ? "SCANNING"
          : analysisStatus === "error"
            ? "ERROR"
            : "ACTIVE"}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#63a4ff] shadow-[0_0_7px_#4f91ed]" />
        LOCAL
      </span>
    </div>
  </aside>
);
