import type { DragEvent, KeyboardEvent, RefObject } from "react";
import {
  CarIcon,
  HelpIcon,
  ImageIcon,
  PlayIcon,
  TrashIcon,
  UploadIcon,
  VideoIcon,
} from "../../components/Icons";

type FileInputRef = RefObject<HTMLInputElement | null>;

export const MainHeader = () => (
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
);

export const EmptyDetectionSidebar = () => (
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
        LOCAL MODE
      </span>
    </div>
  </aside>
);

type SelectedFilePreviewProps = {
  file: File;
  fileUrl: string;
  isVideo: boolean;
  onAnalyze: () => void;
  onRemove: () => void;
};

export const SelectedFilePreview = ({
  file,
  fileUrl,
  isVideo,
  onAnalyze,
  onRemove,
}: SelectedFilePreviewProps) => (
  <section
    aria-label="선택한 수사 자료 미리보기"
    className="flex h-[520px] w-full max-w-5xl flex-col overflow-hidden border border-[#30445a] bg-[#07131f] shadow-[0_18px_60px_rgba(0,0,0,0.24)] max-sm:h-[430px]"
  >
    <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[#253a4e] bg-[#0d2031] px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-[#9cabc0]">
          {isVideo ? <VideoIcon /> : <ImageIcon />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-[#d8e2f1]">{file.name}</p>
          <p className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-[#71849a]">
            분석 준비 완료
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          className="flex h-8 items-center gap-2 rounded bg-[#066bd2] px-4 text-xs text-white transition-colors hover:bg-[#0879eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#76b7ff]"
          onClick={onAnalyze}
          type="button"
        >
          <PlayIcon />
          <span>분석 시작</span>
        </button>
        <button
          aria-label="선택한 파일 삭제"
          className="flex h-8 items-center gap-2 rounded border border-[#563743] bg-[#281b25] px-3 text-xs text-[#e1a8b5] transition-colors hover:border-[#8b4c5c] hover:bg-[#3b202b] hover:text-[#ffd1da] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d17489]"
          onClick={onRemove}
          type="button"
        >
          <TrashIcon />
          <span className="max-sm:hidden">파일 삭제</span>
        </button>
      </div>
    </div>
    <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4">
      {isVideo ? (
        <video className="h-full w-full object-contain" controls key={fileUrl} src={fileUrl}>
          브라우저에서 동영상 재생을 지원하지 않습니다.
        </video>
      ) : (
        <img
          alt={`선택한 수사 자료: ${file.name}`}
          className="h-full w-full object-contain"
          src={fileUrl}
        />
      )}
    </div>
  </section>
);

type UploadDropzoneProps = {
  inputRef: FileInputRef;
  isDragging: boolean;
  onDragStateChange: (dragging: boolean) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
};

export const UploadDropzone = ({
  inputRef,
  isDragging,
  onDragStateChange,
  onDrop,
}: UploadDropzoneProps) => {
  const openPicker = () => inputRef.current?.click();
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div
      aria-label="MP4, JPG 또는 PNG 파일 업로드"
      className={`flex h-[420px] w-full max-w-3xl cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 text-center transition-all ${
        isDragging
          ? "border-[#2b87ed] bg-[#0d2237] shadow-[0_0_30px_rgba(0,103,214,0.15)]"
          : "border-[#3d4d61] bg-[#0a1a2b]/40 hover:border-[#617189] hover:bg-[#0b1e31]"
      } max-sm:h-[360px]`}
      onClick={openPicker}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragStateChange(true);
      }}
      onDragLeave={() => onDragStateChange(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
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
          openPicker();
        }}
        type="button"
      >
        <UploadIcon />
        파일 찾아보기
      </button>
    </div>
  );
};
