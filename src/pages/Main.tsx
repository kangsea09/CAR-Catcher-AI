import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  EmptyDetectionSidebar,
  MainHeader,
  SelectedFilePreview,
  UploadDropzone,
} from "../features/main/MainView";
import { useObjectUrl } from "../hooks/useObjectUrl";
import {
  isSupportedMediaFile,
  isVideoFile,
  SUPPORTED_MEDIA_ACCEPT,
} from "../lib/media";
import "../App.css";

const Main = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const previewUrl = useObjectUrl(selectedFile);
  const selectedIsVideo = isVideoFile(selectedFile);

  const selectFile = (file?: File) => {
    if (file && isSupportedMediaFile(file)) {
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

  const removeFile = () => {
    setSelectedFile(null);
    setIsDragging(false);

    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-[#061625] font-sans text-[#c8d3e5]">
      <MainHeader />
      <div className="flex min-h-[calc(100vh-64px)] max-md:flex-col">
        <EmptyDetectionSidebar />
        <main className="flex min-h-[600px] flex-1 items-center justify-center px-8 py-12 max-sm:min-h-[480px] max-sm:px-4">
          <input
            accept={SUPPORTED_MEDIA_ACCEPT}
            className="sr-only"
            onChange={handleInputChange}
            ref={inputRef}
            type="file"
          />
          {selectedFile ? (
            <SelectedFilePreview
              file={selectedFile}
              fileUrl={previewUrl}
              isVideo={selectedIsVideo}
              onAnalyze={() =>
                navigate("/analyze", { state: { file: selectedFile } })
              }
              onRemove={removeFile}
            />
          ) : (
            <UploadDropzone
              inputRef={inputRef}
              isDragging={isDragging}
              onDragStateChange={setIsDragging}
              onDrop={handleDrop}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default Main;
