from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from pipeline import (
    ModelNotReadyError,
    analyze,
    classifier_path,
    classifier_ready,
    model_path,
    model_ready,
    vehicle_model_path,
    vehicle_model_ready,
)


MAX_UPLOAD_BYTES = 150 * 1024 * 1024

app = FastAPI(title="CAR-Catcher Local Vision API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, object]:
    return {
        "status": "ready" if model_ready() and classifier_ready() else "model-required",
        "modelReady": model_ready(),
        "modelPath": str(model_path()),
        "classifierReady": classifier_ready(),
        "classifierPath": str(classifier_path()),
        "vehicleCrossCheckReady": vehicle_model_ready(),
        "vehicleCrossCheckPath": str(vehicle_model_path()),
    }


@app.post("/api/analyze")
async def analyze_media(file: UploadFile = File(...)) -> dict[str, object]:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="빈 파일은 분석할 수 없습니다.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="파일 크기는 150MB 이하여야 합니다.")

    try:
        return analyze(data, file.filename or "upload", file.content_type or "")
    except ModelNotReadyError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"로컬 분석 실패: {error}") from error
