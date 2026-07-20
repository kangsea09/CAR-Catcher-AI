import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnalysisResultsPanel } from "../features/analysis/AnalysisResultsPanel";
import { AnalysisSidebar } from "../features/analysis/AnalysisSidebar";
import { MediaAnalysisStage } from "../features/analysis/MediaAnalysisStage";
import type { AnalysisStatus } from "../features/analysis/model";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { isSupportedMediaFile, isVideoFile } from "../lib/media";
import "../App.css";

type AnalysisLocationState = {
  file?: File;
};

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
  const mediaUrl = useObjectUrl(file);
  const isVideo = isVideoFile(file);

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

  const startAnalysis = (nextFile?: File) => {
    const analysisFile = nextFile ?? file;
    if (!analysisFile) return;

    setFile(analysisFile);
    setSelectedVehicle(0);
    setIsEnhanced(false);
    setAnalysisProgress(0);
    setAnalysisStatus("analyzing");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile && isSupportedMediaFile(nextFile)) startAnalysis(nextFile);
  };

  const handleVehicleSelect = (index: number) => {
    if (analysisStatus !== "complete") return;
    setSelectedVehicle(index);
    setIsEnhanced(true);
  };

  return (
    <div className="min-h-screen bg-[#061523] font-sans text-[#c9d4e5]">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[320px_minmax(540px,1fr)_400px]">
        <AnalysisSidebar
          analysisProgress={analysisProgress}
          analysisStatus={analysisStatus}
          file={file}
          inputRef={inputRef}
          isVideo={isVideo}
          onFileChange={handleFileChange}
          onHome={() => navigate("/")}
          onVehicleSelect={handleVehicleSelect}
          selectedVehicle={selectedVehicle}
        />
        <MediaAnalysisStage
          analysisProgress={analysisProgress}
          analysisStatus={analysisStatus}
          file={file}
          inputRef={inputRef}
          isEnhanced={isEnhanced}
          isVideo={isVideo}
          mediaUrl={mediaUrl}
          onVehicleSelect={handleVehicleSelect}
          selectedVehicle={selectedVehicle}
        />
        <AnalysisResultsPanel
          analysisProgress={analysisProgress}
          analysisStatus={analysisStatus}
          file={file}
          isEnhanced={isEnhanced}
          isVideo={isVideo}
          mediaUrl={mediaUrl}
          onRestart={() => startAnalysis()}
          selectedVehicle={selectedVehicle}
        />
      </div>
    </div>
  );
};

export default Analyze;
