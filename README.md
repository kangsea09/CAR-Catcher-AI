# CAR-Catcher Local AI

JPG, PNG, MP4 자료에서 차량을 감지하고 복원 프레임과 분석 결과를 보여주는 로컬 비전 애플리케이션입니다. Gemini, Firebase 및 클라우드 API 키를 사용하지 않습니다.

## 처리 파이프라인

- 이미지: 주야간 자동 판별 → 톤 매핑 → Richardson–Lucy 디블러링 → 로컬 차량 탐지
- 동영상: 중앙 연속 5프레임 추출 → ECC 정렬 → 중앙값 합성 → 주야간 복원 → 차량 탐지
- 야간: 색상 노이즈 제거 → 암부 CLAHE·감마 복원 → 헤드라이트 과노출 압축 → 저강도 디블러링
- 결과: 차량 박스, 차체 종류, 운행 용도 단서, 색상 추정, 제조사·모델·연식 Top-3, 실제 복원 프레임
- 참고 사진: Top-1 제품명으로 Wikimedia Commons를 검색해 동일 차종 사진과 출처 링크 표시

경량 YOLO가 차량 위치를 찾고, Stanford Cars 196종으로 학습된 ResNet50 ONNX 분류기가 각 차량 영역의 제조사·모델·연식 Top-3를 추론합니다. 제품명 분류에는 차량 주변 여백과 비율을 보존한 원본·보정본 앙상블을 사용합니다. 후보 신뢰도와 입력 간 일치도가 낮으면 특정 제품명을 확정하지 않습니다. 분류 데이터가 2013년 이전 북미 판매 모델 중심이므로 최신 차량이나 데이터셋에 없는 국내 차종은 별도 재학습이 필요합니다.

분석 결과는 `차체 종류 → 운행 용도 → 제품명 → 교차검증` 단계로 분리됩니다. 택시는 차체 종류가 아니라 운행 용도이므로 지붕 표시등과 유사한 시각 단서가 강할 때만 `택시 추정`으로 표시하고, 그 외에는 `일반/용도 미상`으로 보류합니다. 이 단서는 학습 모델을 대신하지 않으므로 실제 한국 택시 CCTV 자료를 라벨링한 용도 분류 모델이 추가되어야 확정 판정이 가능합니다.

선택 사항으로 VehicleDINO FP32 ONNX 파일을 `server/models/vehicledino_dinov2.onnx`에 두면 승용차·SUV·트럭·버스·밴 차체 분류를 YOLO 결과와 교차검증합니다. 공개 INT8 파일은 Windows CPU ONNX Runtime에서 지원되지 않는 `ConvInteger` 연산을 포함하므로 이 프로젝트에서는 사용하지 않습니다. 교차검증 모델이 없거나 신뢰도가 낮으면 기존 탐지 분류를 유지합니다.

## 요구 사항

- Node.js 20 이상
- Python 3.11 이상
- 최초 설치 시 Python 패키지와 모델을 내려받기 위한 인터넷 연결
- 설치 이후 분석은 로컬에서 실행되며 API 키가 필요하지 않음

## 최초 설치

PowerShell에서 다음 명령을 실행합니다.

```powershell
npm install
.\server\setup.ps1
Copy-Item .env.example .env.local
```

탐지 모델은 `server/models/yolo11n.onnx`, 제품명 분류 모델은 `server/models/resnet50_cars_enhanced.onnx`에 저장되며 Git에는 포함되지 않습니다. PyTorch 없이 OpenCV DNN과 ONNX Runtime CPU로 실행합니다. 다른 호환 모델은 `LOCAL_VISION_MODEL`, `LOCAL_VEHICLE_CLASSIFIER` 환경변수로 지정할 수 있습니다.

## 실행

터미널 1에서 로컬 분석 서버를 실행합니다.

```powershell
.\server\start.ps1
```

터미널 2에서 웹 화면을 실행합니다.

```powershell
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다. 서버 상태는 `http://127.0.0.1:8000/api/health`에서 확인할 수 있습니다.

## 환경 설정

```dotenv
VITE_LOCAL_AI_URL=http://127.0.0.1:8000
```

외부 배포 환경에서는 브라우저가 사용자의 PC에 있는 `127.0.0.1` 서버에 접근해야 하므로 HTTPS 혼합 콘텐츠와 CORS 구성을 별도로 고려해야 합니다. 현재 구성은 로컬 개발 실행을 목표로 합니다. 차량 분석은 로컬에서 수행하지만 참고 사진 검색에는 인터넷 연결이 필요하며, 검색 실패 시 복원 프레임을 표시합니다.

## 검증

```powershell
npm run build
npm run lint
```
