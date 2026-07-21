import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnalysisResultsPanel } from "../features/analysis/AnalysisResultsPanel";
import { AnalysisSidebar } from "../features/analysis/AnalysisSidebar";
import { MediaAnalysisStage } from "../features/analysis/MediaAnalysisStage";
import type {
  AnalysisStatus,
  Vehicle,
} from "../features/analysis/model";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { isSupportedMediaFile, isVideoFile } from "../lib/media";
import { analyzeVehicleMedia } from "../services/vehicleAnalysis";
import "../App.css";

type AnalysisLocationState = {
  file?: File;
};

const stageLabels: Record<string, string> = {
  decode: "미디어 디코딩 중",
  "tone-map": "톤 매핑 중",
  deblur: "디블러링 중",
  "frame-extract": "연속 프레임 추출 중",
  "frame-stack": "연속 프레임 합성 중",
  encode: "보정 이미지 생성 중",
  "request-package": "분석 자료 준비 중",
  "local-analysis": "로컬 AI 차량 분석 중",
  "response-validation": "분석 결과 검증 중",
  complete: "분석 완료",
};

const getInitialFile = (state: unknown) => {
  const file = (state as AnalysisLocationState | null)?.file;
  return file instanceof File ? file : null;
};

const getErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "차량 분석에 실패했습니다.";

  if (message.includes("413") || message.toLowerCase().includes("too large")) {
    return "분석 요청 크기가 제한을 초과했습니다. 더 짧거나 용량이 작은 동영상을 사용하세요.";
  }

  if (message.includes("탐지 모델이 없습니다")) {
    return "로컬 탐지 모델이 없습니다. PowerShell에서 .\\server\\setup.ps1을 먼저 실행하세요.";
  }

  return message;
};

const Analyze = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const initialRunStartedRef = useRef(false);
  const requestIdRef = useRef(0);
  const analysisTargetProgressRef = useRef(0);
  const [file, setFile] = useState<File | null>(() => getInitialFile(location.state));
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState(0);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState("분석 준비 중");
  const [analysisError, setAnalysisError] = useState("");
  const [enhancedImage, setEnhancedImage] = useState("");
  const mediaUrl = useObjectUrl(file);
  const isVideo = isVideoFile(file);
  const displayedProgress = Math.floor(analysisProgress);

  useEffect(() => {
    if (analysisStatus !== "analyzing") return;

    const timer = window.setInterval(() => {
      setAnalysisProgress((current) => {
        const target = analysisTargetProgressRef.current;

        if (target >= 100) {
          const remaining = 100 - current;
          return Math.min(100, current + Math.max(0.8, remaining * 0.14));
        }

        const continuousTarget = Math.min(97, Math.max(target, current + 0.35));
        const distance = continuousTarget - current;
        const next = current + Math.min(1.2, Math.max(0.18, distance * 0.16));
        return Math.min(97, Math.round(next * 10) / 10);
      });
    }, 80);

    return () => window.clearInterval(timer);
  }, [analysisStatus]);

  const startAnalysis = useCallback(
    async (nextFile?: File) => {
      const analysisFile = nextFile ?? file;
      if (!analysisFile) return;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setFile(analysisFile);
      setVehicles([]);
      setSelectedVehicle(0);
      setIsEnhanced(false);
      analysisTargetProgressRef.current = 0;
      setAnalysisProgress(0);
      setAnalysisStage("분석 준비 중");
      setAnalysisError("");
      setEnhancedImage("");
      setAnalysisStatus("analyzing");

      try {
        const result = await analyzeVehicleMedia(analysisFile, (update) => {
          if (requestIdRef.current !== requestId) return;
          analysisTargetProgressRef.current = Math.max(
            analysisTargetProgressRef.current,
            Math.min(97, update.progress),
          );
          setAnalysisStage(stageLabels[update.stage] ?? "로컬 AI 분석 중");
        });

        if (requestIdRef.current !== requestId) return;
        analysisTargetProgressRef.current = 100;
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        if (requestIdRef.current !== requestId) return;
        setVehicles(result.vehicles);
        setEnhancedImage(result.enhancedImage ?? "");
        setAnalysisProgress(100);
        setAnalysisStage("분석 완료");
        setAnalysisStatus("complete");
        setIsEnhanced(Boolean(result.enhancedImage));
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        setAnalysisError(getErrorMessage(error));
        setAnalysisStatus("error");
        setAnalysisStage("분석 실패");
      }
    },
    [file],
  );

  useEffect(() => {
    const initialFile = getInitialFile(location.state);
    if (initialFile && !initialRunStartedRef.current) {
      initialRunStartedRef.current = true;
      void startAnalysis(initialFile);
    }
  }, [location.state, startAnalysis]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile && isSupportedMediaFile(nextFile)) {
      void startAnalysis(nextFile);
    }
  };

  const handleVehicleSelect = (index: number) => {
    if (analysisStatus !== "complete") return;
    setSelectedVehicle(index);
    setIsEnhanced(true);
  };

  return (
    <div className="relative min-h-screen bg-[#061523] font-sans text-[#c9d4e5]">
      {analysisError && (
        <div
          className="fixed left-1/2 top-4 z-[70] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 border border-[#7e4552] bg-[#311b25]/95 px-5 py-3 text-center text-sm text-[#ffd0d9] shadow-xl backdrop-blur"
          role="alert"
        >
          {analysisError}
        </div>
      )}

      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[320px_minmax(540px,1fr)_400px]">
        <AnalysisSidebar
          analysisProgress={displayedProgress}
          analysisStatus={analysisStatus}
          file={file}
          inputRef={inputRef}
          isVideo={isVideo}
          onFileChange={handleFileChange}
          onHome={() => navigate("/")}
          onVehicleSelect={handleVehicleSelect}
          selectedVehicle={selectedVehicle}
          vehicles={vehicles}
        />
        <MediaAnalysisStage
          analysisProgress={displayedProgress}
          analysisStage={analysisStage}
          analysisStatus={analysisStatus}
          file={file}
          enhancedMediaUrl={enhancedImage}
          inputRef={inputRef}
          isEnhanced={isEnhanced}
          isVideo={isVideo}
          mediaUrl={mediaUrl}
          onVehicleSelect={handleVehicleSelect}
          selectedVehicle={selectedVehicle}
          vehicles={vehicles}
        />
        <AnalysisResultsPanel
          analysisProgress={displayedProgress}
          analysisStatus={analysisStatus}
          enhancedMediaUrl={enhancedImage}
          file={file}
          isEnhanced={isEnhanced}
          isVideo={isVideo}
          mediaUrl={mediaUrl}
          onRestart={() => void startAnalysis()}
          selectedVehicle={selectedVehicle}
          vehicles={vehicles}
        />
      </div>
    </div>
  );
};

export default Analyze;
