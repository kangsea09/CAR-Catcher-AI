"""Download and verify the detector once for fully local ONNX inference."""

import ast
import hashlib
import json
from pathlib import Path
import time
from urllib.request import Request, urlopen


MODEL_NAME = "yolo11n.onnx"
MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_URL = "https://huggingface.co/webnn/yolo11n/resolve/main/onnx/yolo11n.onnx"
MODEL_SHA256 = "7d8fd1717d9d5bbab6986cd134afb620649c7a394303d55b1e09fc00804cc5c1"
CLASSIFIER_NAME = "resnet50_cars_enhanced.onnx"
CLASSIFIER_URL = (
    "https://huggingface.co/zededa/resnet50-cars/resolve/main/"
    "resnet50_cars_enhanced.onnx"
)
CLASSIFIER_SHA256 = "242ae51f5e3168d196df19808aa4feb9f47699f5cd0d7070a056af77f8680815"
LABELS_NAME = "stanford_cars_labels.json"
LABELS_URL = (
    "https://huggingface.co/datasets/HuggingFaceM4/Stanford-Cars/"
    "resolve/main/Stanford-Cars.py"
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as model_file:
        for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_verified(name: str, url: str, expected_sha256: str) -> Path:
    destination = MODEL_DIR / name
    if destination.is_file() and sha256(destination) == expected_sha256:
        print(f"Local model already ready: {destination}")
        return destination

    temporary = destination.with_suffix(".download")
    request = Request(url, headers={"User-Agent": "CAR-Catcher-Local/1.0"})
    try:
        last_error: Exception | None = None
        for attempt in range(1, 4):
            try:
                with urlopen(request, timeout=60) as response, temporary.open("wb") as output:
                    while chunk := response.read(1024 * 1024):
                        output.write(chunk)
                last_error = None
                break
            except Exception as error:
                last_error = error
                temporary.unlink(missing_ok=True)
                if attempt < 3:
                    print(f"Model download retry {attempt}/3...")
                    time.sleep(attempt * 2)
        if last_error is not None:
            raise RuntimeError(f"모델 다운로드에 3회 실패했습니다: {last_error}") from last_error
        if sha256(temporary) != expected_sha256:
            raise RuntimeError("다운로드한 모델의 SHA-256 검증에 실패했습니다.")
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Local model ready: {destination}")
    return destination


def download_labels() -> Path:
    destination = MODEL_DIR / LABELS_NAME
    request = Request(LABELS_URL, headers={"User-Agent": "CAR-Catcher-Local/1.0"})
    with urlopen(request, timeout=60) as response:
        source = response.read().decode("utf-8")
    syntax_tree = ast.parse(source)
    labels: list[str] | None = None
    for node in syntax_tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "_NAMES"
            for target in node.targets
        ):
            labels = ast.literal_eval(node.value)
            break
    if not labels or len(labels) != 196:
        raise RuntimeError("Stanford Cars 클래스 196개를 읽을 수 없습니다.")

    # The classifier was trained from ImageFolder directories, whose classes
    # are indexed in alphabetical order.
    destination.write_text(
        json.dumps(sorted(labels), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Vehicle labels ready: {destination}")
    return destination


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    download_verified(MODEL_NAME, MODEL_URL, MODEL_SHA256)
    download_verified(CLASSIFIER_NAME, CLASSIFIER_URL, CLASSIFIER_SHA256)
    download_labels()


if __name__ == "__main__":
    main()
