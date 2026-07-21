import { isVideoFile } from "../lib/media";

export type ProcessingStage =
  | "decode"
  | "tone-map"
  | "deblur"
  | "frame-extract"
  | "frame-stack"
  | "encode";

export type ProcessingProgress = {
  progress: number;
  stage: ProcessingStage;
};

export type PreparedMedia = {
  blob: Blob;
  label: string;
  mimeType: string;
};

export type PreparedAnalysisInput = {
  media: PreparedMedia[];
  processingNote: string;
};

type ProgressHandler = (progress: ProcessingProgress) => void;

const MAX_MEDIA_EDGE = 1280;
// Raw uploads can contain unsupported codecs, metadata, or exceed the inline
// request limit after base64 encoding. Gemini receives normalized JPEGs only.
const RAW_MEDIA_INLINE_LIMIT = 0;

const fitSize = (width: number, height: number) => {
  const scale = Math.min(1, MAX_MEDIA_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const getContext = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("브라우저에서 Canvas 처리를 시작할 수 없습니다.");
  return context;
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.88,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지 인코딩에 실패했습니다."))),
      type,
      quality,
    );
  });

const toneMapAndSharpen = (canvas: HTMLCanvasElement) => {
  const context = getContext(canvas);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const normalized = data[index + channel] / 255;
      const gammaAdjusted = Math.pow(normalized, 0.86);
      const contrasted = (gammaAdjusted - 0.5) * 1.12 + 0.5;
      data[index + channel] = Math.max(0, Math.min(255, contrasted * 255));
    }
  }

  const toned = new Uint8ClampedArray(data);
  const width = canvas.width;
  const height = canvas.height;
  const amount = 0.42;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const blur =
          (toned[pixel - 4 + channel] +
            toned[pixel + 4 + channel] +
            toned[pixel - width * 4 + channel] +
            toned[pixel + width * 4 + channel]) /
          4;
        const sharpened = toned[pixel + channel] + amount * (toned[pixel + channel] - blur);
        data[pixel + channel] = Math.max(0, Math.min(255, sharpened));
      }
    }
  }

  context.putImageData(image, 0, 0);
};

const drawImageBitmap = (bitmap: ImageBitmap) => {
  const size = fitSize(bitmap.width, bitmap.height);
  const canvas = createCanvas(size.width, size.height);
  getContext(canvas).drawImage(bitmap, 0, 0, size.width, size.height);
  return canvas;
};

const prepareImage = async (
  file: File,
  onProgress: ProgressHandler,
): Promise<PreparedAnalysisInput> => {
  onProgress({ progress: 8, stage: "decode" });
  const bitmap = await createImageBitmap(file);
  const canvas = drawImageBitmap(bitmap);
  bitmap.close();

  const resizedOriginal = await canvasToBlob(canvas, "image/jpeg", 0.9);
  onProgress({ progress: 24, stage: "tone-map" });
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  toneMapAndSharpen(canvas);
  onProgress({ progress: 45, stage: "deblur" });

  const enhanced = await canvasToBlob(canvas, "image/jpeg", 0.9);
  onProgress({ progress: 55, stage: "encode" });

  return {
    media: [
      {
        blob: file.size <= RAW_MEDIA_INLINE_LIMIT ? file : resizedOriginal,
        label: file.size <= RAW_MEDIA_INLINE_LIMIT ? "원본 이미지" : "크기 최적화 원본 이미지",
        mimeType: file.size <= RAW_MEDIA_INLINE_LIMIT ? file.type || "image/jpeg" : "image/jpeg",
      },
      { blob: enhanced, label: "톤 매핑 및 디블러링 보정 이미지", mimeType: "image/jpeg" },
    ],
    processingNote:
      "첫 번째 이미지는 원본이며 두 번째 이미지는 브라우저에서 톤 매핑과 샤프닝 기반 디블러링을 적용한 보정본입니다.",
  };
};

const loadVideo = (file: File) =>
  new Promise<{ video: HTMLVideoElement; url: string }>((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("동영상 메타데이터를 읽을 수 없습니다."));
    };
    video.src = url;
  });

const seekVideo = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("동영상 프레임을 추출할 수 없습니다."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = Math.max(0, Math.min(time, Math.max(0, video.duration - 0.05)));
  });

const captureVideoFrame = async (
  video: HTMLVideoElement,
  time: number,
  width: number,
  height: number,
) => {
  await seekVideo(video, time);
  const canvas = createCanvas(width, height);
  const context = getContext(canvas);
  context.drawImage(video, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
};

const estimateTranslation = (
  reference: ImageData,
  candidate: ImageData,
  width: number,
  height: number,
) => {
  let bestScore = Number.POSITIVE_INFINITY;
  let bestX = 0;
  let bestY = 0;
  const sampleStep = Math.max(8, Math.floor(Math.min(width, height) / 45));

  for (let dy = -6; dy <= 6; dy += 2) {
    for (let dx = -6; dx <= 6; dx += 2) {
      let score = 0;
      let samples = 0;
      for (let y = 8; y < height - 8; y += sampleStep) {
        for (let x = 8; x < width - 8; x += sampleStep) {
          const referenceIndex = (y * width + x) * 4;
          const candidateIndex = ((y + dy) * width + x + dx) * 4;
          const referenceLuma =
            reference.data[referenceIndex] * 0.299 +
            reference.data[referenceIndex + 1] * 0.587 +
            reference.data[referenceIndex + 2] * 0.114;
          const candidateLuma =
            candidate.data[candidateIndex] * 0.299 +
            candidate.data[candidateIndex + 1] * 0.587 +
            candidate.data[candidateIndex + 2] * 0.114;
          score += Math.abs(referenceLuma - candidateLuma);
          samples += 1;
        }
      }

      const normalizedScore = score / Math.max(1, samples);
      if (normalizedScore < bestScore) {
        bestScore = normalizedScore;
        bestX = dx;
        bestY = dy;
      }
    }
  }

  return { x: bestX, y: bestY };
};

const stackFrames = (frames: ImageData[], width: number, height: number) => {
  const reference = frames[Math.floor(frames.length / 2)];
  const translations = frames.map((frame) =>
    frame === reference ? { x: 0, y: 0 } : estimateTranslation(reference, frame, width, height),
  );
  const output = new ImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const outputIndex = (y * width + x) * 4;
      let red = 0;
      let green = 0;
      let blue = 0;

      frames.forEach((frame, frameIndex) => {
        const sourceX = Math.max(0, Math.min(width - 1, x + translations[frameIndex].x));
        const sourceY = Math.max(0, Math.min(height - 1, y + translations[frameIndex].y));
        const sourceIndex = (sourceY * width + sourceX) * 4;
        red += frame.data[sourceIndex];
        green += frame.data[sourceIndex + 1];
        blue += frame.data[sourceIndex + 2];
      });

      output.data[outputIndex] = red / frames.length;
      output.data[outputIndex + 1] = green / frames.length;
      output.data[outputIndex + 2] = blue / frames.length;
      output.data[outputIndex + 3] = 255;
    }
  }

  return output;
};

const imageDataToBlob = async (imageData: ImageData) => {
  const canvas = createCanvas(imageData.width, imageData.height);
  getContext(canvas).putImageData(imageData, 0, 0);
  return canvasToBlob(canvas, "image/jpeg", 0.86);
};

const prepareVideo = async (
  file: File,
  onProgress: ProgressHandler,
): Promise<PreparedAnalysisInput> => {
  onProgress({ progress: 5, stage: "decode" });
  const { video, url } = await loadVideo(file);

  try {
    const size = fitSize(video.videoWidth, video.videoHeight);
    const center = Math.min(Math.max(video.duration * 0.5, 0.2), Math.max(0.2, video.duration - 0.2));
    const frameStep = 1 / 15;
    const consecutiveTimes = [-2, -1, 0, 1, 2].map((offset) => center + offset * frameStep);
    const consecutiveFrames: ImageData[] = [];

    for (let index = 0; index < consecutiveTimes.length; index += 1) {
      consecutiveFrames.push(
        await captureVideoFrame(video, consecutiveTimes[index], size.width, size.height),
      );
      onProgress({
        progress: 10 + Math.round(((index + 1) / consecutiveTimes.length) * 18),
        stage: "frame-extract",
      });
    }

    onProgress({ progress: 34, stage: "frame-stack" });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const stacked = stackFrames(consecutiveFrames, size.width, size.height);
    const stackedCanvas = createCanvas(size.width, size.height);
    getContext(stackedCanvas).putImageData(stacked, 0, 0);
    toneMapAndSharpen(stackedCanvas);
    const stackedBlob = await canvasToBlob(stackedCanvas, "image/jpeg", 0.9);

    const contextTimes = [0.2, 0.5, 0.8].map((ratio) => video.duration * ratio);
    const contextFrames: PreparedMedia[] = [];
    for (let index = 0; index < contextTimes.length; index += 1) {
      const frame = await captureVideoFrame(video, contextTimes[index], size.width, size.height);
      contextFrames.push({
        blob: await imageDataToBlob(frame),
        label: `동영상 대표 프레임 ${index + 1}`,
        mimeType: "image/jpeg",
      });
      onProgress({
        progress: 40 + Math.round(((index + 1) / contextTimes.length) * 12),
        stage: "frame-extract",
      });
    }

    const media: PreparedMedia[] = [
      ...contextFrames,
      {
        blob: stackedBlob,
        label: "연속 5프레임 전역 흔들림 정렬·평균 합성 및 보정 이미지",
        mimeType: "image/jpeg",
      },
    ];

    if (file.size <= RAW_MEDIA_INLINE_LIMIT) {
      media.unshift({
        blob: file,
        label: "원본 동영상",
        mimeType: file.type || "video/mp4",
      });
    }

    onProgress({ progress: 55, stage: "encode" });
    return {
      media,
      processingNote:
        file.size <= RAW_MEDIA_INLINE_LIMIT
          ? "원본 동영상, 3개의 대표 프레임, 연속 5프레임의 전역 흔들림 정렬·평균 합성 보정본이 순서대로 제공됩니다."
          : "파일 크기 제한으로 원본 동영상 대신 3개의 대표 프레임과 연속 5프레임의 전역 흔들림 정렬·평균 합성 보정본이 제공됩니다.",
    };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
};

export const prepareMediaForAnalysis = (
  file: File,
  onProgress: ProgressHandler,
) =>
  isVideoFile(file)
    ? prepareVideo(file, onProgress)
    : prepareImage(file, onProgress);
