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
  box: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  candidates: VehicleCandidate[];
  evidence: string[];
};

export type AnalysisResult = {
  vehicles: Vehicle[];
  summary: string;
};
