import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

const VideoIcon = ({ className = "" }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 48 48"
  >
    <path
      d="M8 17.5h32v22H8v-22Zm0 0L4.5 9H11l5 8.5L12.5 9H20l5 8.5L21.5 9H29l5 8.5L30.5 9H40v8.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3.5"
    />
  </svg>
);

const ImageIcon = ({ className = "" }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 48 48"
  >
    <rect
      height="34"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="3.5"
      width="34"
      x="7"
      y="7"
    />
    <path
      d="m12 35 9.5-10 6 6 4.5-5 4 9H12Z"
      fill="currentColor"
    />
  </svg>
);

const CarIcon = () => (
  <svg
    aria-hidden="true"
    className="h-8 w-8"
    fill="none"
    viewBox="0 0 32 32"
  >
    <path
      d="m6.5 14.5 2.2-6h14.6l2.2 6M5 16.5h22v8H5v-8Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="2"
    />
    <path d="M8 23v3M24 23v3" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="10" cy="19.5" fill="currentColor" r="1.5" />
    <circle cx="22" cy="19.5" fill="currentColor" r="1.5" />
  </svg>
);

const UploadIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
    <path
      d="M5 3h10l4 4v14H5V3Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
    <path d="M15 3v5h4M12 17V10m0 0-3 3m3-3 3 3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const HelpIcon = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M9.8 9.3a2.3 2.3 0 0 1 4.5.7c0 1.8-2.3 2.1-2.3 3.7M12 17h.01"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
  </svg>
);

const TrashIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
    <path
      d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const PlayIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
    <path
      d="m9 7 8 5-8 5V7Z"
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
    />
  </svg>
);

const Main = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ""),
    [selectedFile],
  );
  const selectedIsVideo =
    selectedFile?.type.startsWith("video/") ||
    selectedFile?.name.toLowerCase().endsWith(".mp4") ||
    false;

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const selectFile = (file?: File) => {
    if (!file) return;

    const normalizedName = file.name.toLowerCase();
    const isVideo = file.type === "video/mp4" || normalizedName.endsWith(".mp4");
    const isImage =
      file.type === "image/jpeg" ||
      file.type === "image/png" ||
      normalizedName.endsWith(".jpg") ||
      normalizedName.endsWith(".jpeg") ||
      normalizedName.endsWith(".png");

    if (isVideo || isImage) {
      setSelectedFile(file);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setIsDragging(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="-mt-[70px] min-h-screen bg-[#061625] font-sans text-[#c8d3e5]">
      <header className="flex h-16 items-center border-b border-[#1b3042] bg-[#0d1d2c]">
        <div className="flex h-full w-80 shrink-0 items-center border-r border-[#203447] px-6 max-md:w-auto max-md:border-r-0">
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#d4dfef]">
            CAR-Catcher AI
          </h1>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between px-6">
          <span className="truncate font-mono text-xs tracking-[0.12em] text-[#d4dbea]">
            NEW_INVESTIGATION
          </span>
          <button
            aria-label="도움말"
            className="ml-4 cursor-pointer text-[#b8c5d8] transition-colors hover:text-white"
            title="지원 형식: MP4, JPG, PNG"
            type="button"
          >
            <HelpIcon />
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)] max-md:flex-col">
        <aside className="flex w-80 shrink-0 flex-col border-r border-[#203447] bg-[#102131] max-md:w-full max-md:border-r-0 max-md:border-b">
          <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-6">
            <h2 className="mb-4 text-sm font-medium text-[#c4cfdf]">감지된 차량</h2>

            <div className="flex min-h-[280px] flex-1 flex-col rounded-sm border border-dashed border-[#172f43] bg-[#0b1c2c]">
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center text-[#8795a9]">
                <CarIcon />
                <p className="mt-3 text-sm leading-5">
                  자료를 업로드하면 감지된 차량
                  <br />
                  목록이 여기에 표시됩니다.
                </p>
              </div>
            </div>
          </div>

          <div className="flex h-12 shrink-0 items-center justify-between border-t border-[#1d3143] px-4 font-mono text-[11px] tracking-[0.1em] text-[#8e9aad]">
            <span>SYS_STATUS: STANDBY</span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#a9c8ff] shadow-[0_0_8px_#79aaff]" />
              ONLINE
            </span>
          </div>
        </aside>

        <main className="flex min-h-[600px] flex-1 items-center justify-center px-8 py-12 max-sm:min-h-[480px] max-sm:px-4">
          <input
            accept=".mp4,.jpg,.jpeg,.png,video/mp4,image/jpeg,image/png"
            className="sr-only"
            onChange={handleInputChange}
            ref={inputRef}
            type="file"
          />

          {selectedFile ? (
            <section
              aria-label="선택한 수사 자료 미리보기"
              className="flex h-[520px] w-full max-w-5xl flex-col overflow-hidden border border-[#30445a] bg-[#07131f] shadow-[0_18px_60px_rgba(0,0,0,0.24)] max-sm:h-[430px]"
            >
              <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[#253a4e] bg-[#0d2031] px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-[#9cabc0]">
                    {selectedIsVideo ? (
                      <VideoIcon className="h-6 w-6" />
                    ) : (
                      <ImageIcon className="h-6 w-6" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[#d8e2f1]">{selectedFile.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-[#71849a]">
                      분석 준비 완료
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    className="flex h-8 items-center gap-2 rounded bg-[#066bd2] px-4 text-xs text-white transition-colors hover:bg-[#0879eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#76b7ff]"
                    onClick={() => navigate("/analyze", { state: { file: selectedFile } })}
                    type="button"
                  >
                    <PlayIcon />
                    <span>분석 시작</span>
                  </button>

                  <button
                    aria-label="선택한 파일 삭제"
                    className="flex h-8 items-center gap-2 rounded border border-[#563743] bg-[#281b25] px-3 text-xs text-[#e1a8b5] transition-colors hover:border-[#8b4c5c] hover:bg-[#3b202b] hover:text-[#ffd1da] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d17489]"
                    onClick={removeFile}
                    type="button"
                  >
                    <TrashIcon />
                    <span className="max-sm:hidden">파일 삭제</span>
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4">
                {selectedIsVideo ? (
                  <video
                    className="h-full w-full object-contain"
                    controls
                    key={previewUrl}
                    src={previewUrl}
                  >
                    브라우저에서 동영상 재생을 지원하지 않습니다.
                  </video>
                ) : (
                  <img
                    alt={`선택한 수사 자료: ${selectedFile.name}`}
                    className="h-full w-full object-contain"
                    src={previewUrl}
                  />
                )}
              </div>
            </section>
          ) : (
            <div
              aria-label="MP4, JPG 또는 PNG 파일 업로드"
              className={`flex h-[420px] w-full max-w-3xl cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 text-center transition-all ${
                isDragging
                  ? "border-[#2b87ed] bg-[#0d2237] shadow-[0_0_30px_rgba(0,103,214,0.15)]"
                  : "border-[#3d4d61] bg-[#0a1a2b]/40 hover:border-[#617189] hover:bg-[#0b1e31]"
              } max-sm:h-[360px]`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onKeyDown={handleKeyDown}
              role="button"
              tabIndex={0}
            >
              <div className="mb-8 flex items-center text-[#bec9dc]">
                <div className="flex w-20 flex-col items-center gap-1">
                  <VideoIcon className="h-11 w-11" />
                  <span className="font-mono text-xs tracking-[0.08em]">MP4</span>
                </div>
                <span className="mx-1 h-12 w-px bg-[#22354a]" />
                <div className="flex w-20 flex-col items-center gap-1">
                  <ImageIcon className="h-11 w-11" />
                  <span className="font-mono text-[10px] tracking-[0.05em]">JPG/PNG</span>
                </div>
              </div>

              <h2 className="text-2xl font-light tracking-[-0.02em] text-[#ced9e9] max-sm:text-xl">
                수사 자료 분석 시작
              </h2>
              <p className="mt-3 text-base text-[#abb7c9] max-sm:text-sm">
                CCTV 영상 또는 사진 파일을 드래그하여 업로드하세요.
              </p>

              <button
                className="mt-8 flex h-11 items-center gap-2 rounded-sm bg-[#066bd2] px-8 text-sm text-white shadow-[0_0_24px_rgba(0,103,214,0.22)] transition-colors hover:bg-[#0879eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#76b7ff]"
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
                type="button"
              >
                <UploadIcon />
                파일 찾아보기
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Main;
