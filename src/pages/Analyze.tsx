import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../App.css";

type AnalysisLocationState = {
  file?: File;
};

type AnalysisStatus = "idle" | "analyzing" | "complete";

type Vehicle = {
  id: string;
  description: string;
  confidence: number;
  box: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

const vehicles: Vehicle[] = [
  {
    id: "VEH_01",
    description: "1차선 검은색 세단",
    confidence: 92,
    box: { left: 18, top: 47, width: 58, height: 44 },
  },
  {
    id: "VEH_02",
    description: "우측 진입 은색 SUV",
    confidence: 89,
    box: { left: 67, top: 21, width: 18, height: 19 },
  },
  {
    id: "VEH_03",
    description: "2차선 검은색 SUV",
    confidence: 62,
    box: { left: 79, top: 27, width: 16, height: 21 },
  },
  {
    id: "VEH_04",
    description: "중앙 소형 SUV",
    confidence: 45,
    box: { left: 62, top: 17, width: 13, height: 14 },
  },
  {
    id: "VEH_05",
    description: "후방 진입 차량",
    confidence: 9,
    box: { left: 53, top: 12, width: 10, height: 11 },
  },
];

const candidates = [
  { name: "현대 그랜저", confidence: 89 },
  { name: "기아 K8", confidence: 72 },
  { name: "제네시스 G80", confidence: 41 },
];

const UploadIcon = () => (
  <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
    <path
      d="M5 3h10l4 4v14H5V3Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path d="M15 3v5h4M12 17V10m0 0-3 3m3-3 3 3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const BackIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
    <path
      d="m14.5 6-6 6 6 6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const ScanIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
    <path
      d="M8 4H4v4m12-4h4v4M8 20H4v-4m12 4h4v-4M7 12h10"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.6"
    />
  </svg>
);

const AnalyzingIcon = () => (
  <svg aria-hidden="true" className="h-12 w-12" fill="none" viewBox="0 0 48 48">
    <circle cx="20" cy="22" r="12" stroke="currentColor" strokeWidth="3" />
    <path
      d="m29 31 9 9M8 23h6l3-7 5 14 4-9h6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
    />
  </svg>
);

const getInitialFile = (state: unknown) => {
  const file = (state as AnalysisLocationState | null)?.file;
  return file instanceof File ? file : null;
};

const Analyze = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(() => getInitialFile(location.state));
  const [selectedVehicle, setSelectedVehicle] = useState(0);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(() =>
    getInitialFile(location.state) ? "analyzing" : "idle",
  );
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const mediaUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  const isVideo =
    file?.type.startsWith("video/") || file?.name.toLowerCase().endsWith(".mp4") || false;
  const selected = vehicles[selectedVehicle];

  useEffect(
    () => () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    },
    [mediaUrl],
  );

  useEffect(() => {
    if (!file || analysisStatus !== "analyzing") return;

    const startedAt = Date.now();
    const duration = isVideo ? 6200 : 4800;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min(100, Math.round((elapsed / duration) * 100));

      setAnalysisProgress(nextProgress);

      if (nextProgress >= 100) {
        window.clearInterval(timer);
        setAnalysisStatus("complete");
        setIsEnhanced(true);
      }
    }, 80);

    return () => window.clearInterval(timer);
  }, [analysisStatus, file, isVideo]);

  const selectFile = (nextFile?: File) => {
    if (!nextFile) return;

    const supported =
      nextFile.type === "image/jpeg" ||
      nextFile.type === "image/png" ||
      nextFile.type === "video/mp4" ||
      nextFile.name.toLowerCase().endsWith(".jpg") ||
      nextFile.name.toLowerCase().endsWith(".jpeg") ||
      nextFile.name.toLowerCase().endsWith(".png") ||
      nextFile.name.toLowerCase().endsWith(".mp4");

    if (!supported) return;

    setFile(nextFile);
    setSelectedVehicle(0);
    setIsEnhanced(false);
    setAnalysisProgress(0);
    setAnalysisStatus("analyzing");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0]);
  };

  const handleVehicleSelect = (index: number) => {
    if (analysisStatus !== "complete") return;

    setSelectedVehicle(index);
    setIsEnhanced(true);
  };

  const restartAnalysis = () => {
    if (!file) return;

    setSelectedVehicle(0);
    setIsEnhanced(false);
    setAnalysisProgress(0);
    setAnalysisStatus("analyzing");
  };

  const boxStyle = (vehicle: Vehicle): CSSProperties => ({
    left: `${vehicle.box.left}%`,
    top: `${vehicle.box.top}%`,
    width: `${vehicle.box.width}%`,
    height: `${vehicle.box.height}%`,
  });

  return (
    <div className="-mt-[70px] min-h-screen bg-[#061523] font-sans text-[#c9d4e5]">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[320px_minmax(540px,1fr)_400px]">
        <aside className="flex min-h-0 flex-col border-r border-[#24384a] bg-[#0d1d2d] xl:h-screen">
          <div className="border-b border-[#26394b] p-6">
            <div className="flex items-center justify-between gap-3">
              <button
                className="flex items-center gap-1 text-left text-xl font-semibold tracking-[-0.02em] text-[#d7e2f1] transition-colors hover:text-white"
                onClick={() => navigate("/")}
                type="button"
              >
                CAR-Catcher AI
              </button>
              <button
                aria-label="새 수사 자료 화면으로 돌아가기"
                className="flex h-8 w-8 items-center justify-center rounded border border-[#2d4257] text-[#8293aa] transition-colors hover:border-[#4d6985] hover:text-white"
                onClick={() => navigate("/")}
                type="button"
              >
                <BackIcon />
              </button>
            </div>

            <input
              accept=".jpg,.jpeg,.png,.mp4,image/jpeg,image/png,video/mp4"
              className="sr-only"
              onChange={handleFileChange}
              ref={inputRef}
              type="file"
            />

            <button
              className="mt-5 flex min-h-[120px] w-full flex-col items-center justify-center border-2 border-dashed border-[#405166] bg-[#0b1a29] px-4 text-center transition-colors hover:border-[#66809c] hover:bg-[#102337]"
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              <span className="text-[#76869c]">
                <UploadIcon />
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
                  : file
                    ? `${vehicles.length} DETECTED`
                    : "WAITING"}
              </span>
            </div>

            {file ? (
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
                      onClick={() => handleVehicleSelect(index)}
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
              AI_ENGINE: {analysisStatus === "analyzing" ? "SCANNING" : "ACTIVE"}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#63a4ff] shadow-[0_0_7px_#4f91ed]" />
              ONLINE
            </span>
          </div>
        </aside>

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
                    onClick={() => handleVehicleSelect(index)}
                    style={boxStyle(vehicle)}
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
                    aria-live="polite"
                    aria-label={`차량 분석 중 ${analysisProgress}%`}
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
                좌측 파일 업로드 영역에서 JPG·PNG 이미지 또는 MP4 동영상을 선택하세요.
                파일 형식을 자동 판별한 뒤 차량 감지를 시작합니다.
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
              <li className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#3189e7]" />
                수평형 LED 헤드램프와 라디에이터 그릴의 연결 패턴이 높은 유사도를 보입니다.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#3189e7]" />
                5-스포크 휠 형상과 휠베이스 비율이 1순위 후보의 제원과 일치합니다.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#3189e7]" />
                C필러 곡률과 후면 유리 각도를 종합해 세단 계열로 판단했습니다.
              </li>
            </ul>
          </section>

          <button
            className="mt-6 w-full bg-[#0873dc] py-3 text-sm text-white transition-colors hover:bg-[#1286f4] disabled:cursor-not-allowed disabled:bg-[#29435b] disabled:text-[#71869a]"
            disabled={!file || analysisStatus === "analyzing"}
            onClick={restartAnalysis}
            type="button"
          >
            {analysisStatus === "analyzing"
              ? `분석 중... ${analysisProgress}%`
              : "다시 분석하기"}
          </button>
        </aside>
      </div>
    </div>
  );
};

export default Analyze;
