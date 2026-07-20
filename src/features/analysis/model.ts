export type AnalysisStatus = "idle" | "analyzing" | "complete";

export type Vehicle = {
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

export type VehicleCandidate = {
  name: string;
  confidence: number;
};

export const vehicles: Vehicle[] = [
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

export const candidates: VehicleCandidate[] = [
  { name: "현대 그랜저", confidence: 89 },
  { name: "기아 K8", confidence: 72 },
  { name: "제네시스 G80", confidence: 41 },
];

export const analysisReasons = [
  "수평형 LED 헤드램프와 라디에이터 그릴의 연결 패턴이 높은 유사도를 보입니다.",
  "5-스포크 휠 형상과 휠베이스 비율이 1순위 후보의 제원과 일치합니다.",
  "C필러 곡률과 후면 유리 각도를 종합해 세단 계열로 판단했습니다.",
];
