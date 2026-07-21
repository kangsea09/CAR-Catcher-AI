export type AnalysisStatus = "idle" | "analyzing" | "complete" | "error";

export type VehicleCandidate = {
  name: string;
  confidence: number;
};

export type Vehicle = {
  id: string;
  description: string;
  confidence: number;
  color: string;
  bodyType: string;
  usageType?: string;
  usageConfidence?: number;
  usageReliable?: boolean;
  bodyCrossCheck?: {
    available: boolean;
    name?: string;
    confidence?: number;
    reliable: boolean;
  };
  inspectionStages?: Array<{
    key: "logo" | "bumper" | "headlights" | "exterior";
    label: string;
    visible: boolean;
    confidence?: number;
  }>;
  box: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  candidates: VehicleCandidate[];
  evidence: string[];
  productReliable?: boolean;
  referenceImage?: {
    url: string;
    sourceUrl: string;
    title: string;
  };
};

export type AnalysisResult = {
  vehicles: Vehicle[];
  summary: string;
  enhancedImage?: string;
};
