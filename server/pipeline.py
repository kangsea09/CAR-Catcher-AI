from __future__ import annotations

import base64
import json
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from web_reference import lookup_vehicle_image


SERVER_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = SERVER_DIR / "models" / "yolo11n.onnx"
DEFAULT_CLASSIFIER_PATH = SERVER_DIR / "models" / "resnet50_cars_enhanced.onnx"
DEFAULT_LABELS_PATH = SERVER_DIR / "models" / "stanford_cars_labels.json"
DEFAULT_VEHICLE_MODEL_PATH = SERVER_DIR / "models" / "vehicledino_dinov2.onnx"
VEHICLE_CLASSES = {2: "자동차", 3: "오토바이", 5: "버스", 7: "트럭"}
VEHICLE_DINO_BODY_TYPES = ["승용차", "SUV", "트럭", "버스", "밴"]
MAX_EDGE = 1600


class ModelNotReadyError(RuntimeError):
    pass


@dataclass
class Detection:
    box: tuple[int, int, int, int]
    confidence: float
    class_id: int


_detector: Any | None = None
_classifier: Any | None = None
_class_labels: list[str] | None = None
_vehicle_model: Any | None = None


def model_path() -> Path:
    configured = os.getenv("LOCAL_VISION_MODEL", "").strip()
    return Path(configured).expanduser().resolve() if configured else DEFAULT_MODEL_PATH


def model_ready() -> bool:
    return model_path().is_file()


def classifier_path() -> Path:
    configured = os.getenv("LOCAL_VEHICLE_CLASSIFIER", "").strip()
    return Path(configured).expanduser().resolve() if configured else DEFAULT_CLASSIFIER_PATH


def classifier_ready() -> bool:
    return classifier_path().is_file() and DEFAULT_LABELS_PATH.is_file()


def vehicle_model_path() -> Path:
    configured = os.getenv("LOCAL_VEHICLE_ATTRIBUTE_MODEL", "").strip()
    return (
        Path(configured).expanduser().resolve()
        if configured
        else DEFAULT_VEHICLE_MODEL_PATH
    )


def vehicle_model_ready() -> bool:
    return vehicle_model_path().is_file()


def _load_detector() -> cv2.dnn.Net:
    global _detector
    if _detector is not None:
        return _detector

    path = model_path()
    if not path.is_file():
        raise ModelNotReadyError(
            "로컬 차량 탐지 모델이 없습니다. server/setup_model.py를 먼저 실행하세요."
        )

    # OpenCV on Windows can fail to open an ONNX file when its path contains
    # non-ASCII characters. Loading the verified bytes avoids that limitation.
    model_buffer = np.fromfile(path, dtype=np.uint8)
    _detector = cv2.dnn.readNetFromONNX(model_buffer)
    return _detector


def _load_classifier() -> tuple[Any, list[str]]:
    global _classifier, _class_labels
    if _classifier is not None and _class_labels is not None:
        return _classifier, _class_labels
    if not classifier_ready():
        raise ModelNotReadyError(
            "차량 제품명 분류 모델이 없습니다. server/setup_model.py를 다시 실행하세요."
        )

    import onnxruntime as ort

    _classifier = ort.InferenceSession(
        str(classifier_path()), providers=["CPUExecutionProvider"]
    )
    labels = json.loads(DEFAULT_LABELS_PATH.read_text(encoding="utf-8"))
    if not isinstance(labels, list) or len(labels) != 196:
        raise RuntimeError("차량 분류 라벨 파일이 올바르지 않습니다.")
    _class_labels = [str(label) for label in labels]
    return _classifier, _class_labels


def _load_vehicle_model() -> Any:
    global _vehicle_model
    if _vehicle_model is not None:
        return _vehicle_model
    if not vehicle_model_ready():
        return None

    import onnxruntime as ort

    _vehicle_model = ort.InferenceSession(
        str(vehicle_model_path()), providers=["CPUExecutionProvider"]
    )
    return _vehicle_model


def _resize(frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    scale = min(1.0, MAX_EDGE / max(height, width))
    if scale == 1.0:
        return frame
    return cv2.resize(
        frame,
        (max(1, round(width * scale)), max(1, round(height * scale))),
        interpolation=cv2.INTER_AREA,
    )


def tone_map(frame: np.ndarray) -> np.ndarray:
    """Local contrast recovery using CLAHE on luminance only."""
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    lightness, channel_a, channel_b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    mapped = clahe.apply(lightness)
    return cv2.cvtColor(cv2.merge((mapped, channel_a, channel_b)), cv2.COLOR_LAB2BGR)


def is_night_scene(frame: np.ndarray) -> bool:
    luminance = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    median_luminance = float(np.median(luminance))
    dark_ratio = float(np.mean(luminance < 65))
    bright_ratio = float(np.mean(luminance > 225))
    # The bright-ratio condition catches dark roads containing small, clipped
    # headlight regions that would otherwise raise the global mean.
    return median_luminance < 82 or (dark_ratio > 0.48 and bright_ratio < 0.12)


def night_tone_map(frame: np.ndarray) -> np.ndarray:
    """Denoise shadows, lift local detail, and compress headlight highlights."""
    denoised = cv2.fastNlMeansDenoisingColored(frame, None, 6, 5, 7, 21)
    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    lightness, channel_a, channel_b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    local_contrast = clahe.apply(lightness).astype(np.float32) / 255.0

    # Gamma lifts the road/body shadows; the shoulder above 0.78 prevents
    # headlights and reflective plates from becoming featureless white blobs.
    lifted = np.power(local_contrast, 0.68)
    compressed = np.where(
        lifted > 0.78,
        0.78 + (lifted - 0.78) * 0.32,
        lifted,
    )
    mapped = np.clip(compressed * 255.0, 0, 255).astype(np.uint8)
    restored = cv2.cvtColor(
        cv2.merge((mapped, channel_a, channel_b)), cv2.COLOR_LAB2BGR
    )

    # A mild bilateral pass removes amplified chroma speckles while retaining
    # grille, lamp, and window edges needed by the product classifier.
    return cv2.bilateralFilter(restored, 5, 28, 28)


def deblur(frame: np.ndarray, iterations: int = 5) -> np.ndarray:
    """Small Richardson-Lucy deconvolution for mild lens/motion blur."""
    source = frame.astype(np.float32) / 255.0
    kernel_1d = cv2.getGaussianKernel(7, 1.35)
    kernel = kernel_1d @ kernel_1d.T
    estimate = np.maximum(source, 1e-4)
    mirrored_kernel = np.flip(kernel)

    for _ in range(iterations):
        convolved = cv2.filter2D(estimate, -1, kernel, borderType=cv2.BORDER_REFLECT)
        relative_blur = source / np.maximum(convolved, 1e-4)
        estimate *= cv2.filter2D(
            relative_blur, -1, mirrored_kernel, borderType=cv2.BORDER_REFLECT
        )
        estimate = np.clip(estimate, 0.0, 1.0)

    return (estimate * 255.0).astype(np.uint8)


def _align(reference: np.ndarray, candidate: np.ndarray) -> np.ndarray:
    reference_gray = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    candidate_gray = cv2.cvtColor(candidate, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    warp = np.eye(2, 3, dtype=np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 60, 1e-5)

    try:
        cv2.findTransformECC(reference_gray, candidate_gray, warp, cv2.MOTION_AFFINE, criteria)
        return cv2.warpAffine(
            candidate,
            warp,
            (reference.shape[1], reference.shape[0]),
            flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
            borderMode=cv2.BORDER_REFLECT,
        )
    except cv2.error:
        return candidate


def fuse_frames(frames: list[np.ndarray]) -> np.ndarray:
    """Align consecutive frames and use a robust median to suppress ghosts/noise."""
    reference = frames[len(frames) // 2]
    aligned = [
        frame if index == len(frames) // 2 else _align(reference, frame)
        for index, frame in enumerate(frames)
    ]
    return np.median(np.stack(aligned, axis=0), axis=0).astype(np.uint8)


def _decode_image(data: bytes) -> np.ndarray:
    frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("이미지 파일을 디코딩할 수 없습니다.")
    return _resize(frame)


def _decode_video(data: bytes, suffix: str) -> list[np.ndarray]:
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(data)
            temp_path = temp_file.name

        capture = cv2.VideoCapture(temp_path)
        if not capture.isOpened():
            raise ValueError("동영상 파일을 디코딩할 수 없습니다.")

        frame_count = max(1, int(capture.get(cv2.CAP_PROP_FRAME_COUNT)))
        center = frame_count // 2
        indices = [max(0, min(frame_count - 1, center + offset)) for offset in (-2, -1, 0, 1, 2)]
        frames: list[np.ndarray] = []
        for index in indices:
            capture.set(cv2.CAP_PROP_POS_FRAMES, index)
            ok, frame = capture.read()
            if ok and frame is not None:
                frames.append(_resize(frame))
        capture.release()

        if not frames:
            raise ValueError("동영상에서 분석 프레임을 추출할 수 없습니다.")
        return frames
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)


def _detect(frame: np.ndarray, confidence_threshold: float = 0.25) -> list[Detection]:
    detector = _load_detector()
    input_size = 640
    height, width = frame.shape[:2]
    scale = min(input_size / width, input_size / height)
    resized_width, resized_height = round(width * scale), round(height * scale)
    resized = cv2.resize(frame, (resized_width, resized_height))
    canvas = np.full((input_size, input_size, 3), 114, dtype=np.uint8)
    pad_x = (input_size - resized_width) // 2
    pad_y = (input_size - resized_height) // 2
    canvas[pad_y : pad_y + resized_height, pad_x : pad_x + resized_width] = resized

    blob = cv2.dnn.blobFromImage(canvas, 1 / 255.0, (input_size, input_size), swapRB=True)
    detector.setInput(blob)
    output = np.squeeze(detector.forward())
    if output.ndim != 2:
        return []
    if output.shape[0] < output.shape[1]:
        output = output.T

    boxes: list[list[int]] = []
    confidences: list[float] = []
    class_ids: list[int] = []
    for prediction in output:
        class_scores = prediction[4:]
        class_id = int(np.argmax(class_scores))
        confidence = float(class_scores[class_id])
        if class_id not in VEHICLE_CLASSES or confidence < confidence_threshold:
            continue

        center_x, center_y, box_width, box_height = prediction[:4]
        x1 = int((center_x - box_width / 2 - pad_x) / scale)
        y1 = int((center_y - box_height / 2 - pad_y) / scale)
        boxes.append([x1, y1, int(box_width / scale), int(box_height / scale)])
        confidences.append(confidence)
        class_ids.append(class_id)

    selected = cv2.dnn.NMSBoxes(boxes, confidences, confidence_threshold, 0.45)
    detections: list[Detection] = []
    for selected_index in selected:
        index = int(selected_index)
        x, y, box_width, box_height = boxes[index]
        detections.append(
            Detection(
                box=(x, y, x + box_width, y + box_height),
                confidence=confidences[index],
                class_id=class_ids[index],
            )
        )
    return detections


def _color_name(crop: np.ndarray, night_mode: bool = False) -> str:
    if crop.size == 0:
        return "색상 판별 불가"
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    hue = float(np.median(hsv[:, :, 0]))
    saturation = float(np.median(hsv[:, :, 1]))
    value = float(np.median(hsv[:, :, 2]))
    if value < 55:
        color = "검정색 계열"
    elif saturation < 30 and value > 190:
        color = "흰색 계열"
    elif saturation < 38:
        color = "회색/은색 계열"
    elif hue < 10 or hue >= 170:
        color = "빨간색 계열"
    elif hue < 25:
        color = "주황/갈색 계열"
    elif hue < 40:
        color = "노란색 계열"
    elif hue < 85:
        color = "초록색 계열"
    elif hue < 135:
        color = "파란색 계열"
    else:
        color = "보라색 계열"
    return f"{color} (야간 추정)" if night_mode else color


KOREAN_MODEL_NAMES = {
    "Hyundai Accent": "현대 엑센트",
    "Hyundai Azera": "현대 그랜저",
    "Hyundai Elantra": "현대 아반떼",
    "Hyundai Genesis": "현대 제네시스",
    "Hyundai Santa Fe": "현대 싼타페",
    "Hyundai Sonata": "현대 쏘나타",
    "Hyundai Tucson": "현대 투싼",
    "Hyundai Veloster": "현대 벨로스터",
    "Hyundai Veracruz": "현대 베라크루즈",
}

KOREAN_BRANDS = {
    "BMW": "BMW",
    "Mercedes-Benz": "메르세데스-벤츠",
    "Volkswagen": "폭스바겐",
    "Toyota": "토요타",
    "Honda": "혼다",
    "Nissan": "닛산",
    "Audi": "아우디",
    "Porsche": "포르쉐",
    "Jeep": "지프",
    "Ford": "포드",
    "Chevrolet": "쉐보레",
    "Hyundai": "현대",
}


def _localize_product_name(label: str) -> str:
    localized = label
    for english, korean in KOREAN_MODEL_NAMES.items():
        if localized.startswith(english):
            localized = korean + localized[len(english) :]
            break
    else:
        for english, korean in KOREAN_BRANDS.items():
            if localized.startswith(english + " "):
                localized = korean + localized[len(english) :]
                break

    localized = localized.replace(" Sedan", " 세단")
    localized = localized.replace(" Hatchback", " 해치백")
    localized = localized.replace(" Convertible", " 컨버터블")
    localized = localized.replace(" Coupe", " 쿠페")
    localized = localized.replace(" Wagon", " 왜건")
    localized = localized.replace(" Minivan", " 미니밴")
    match = re.search(r"\s(19|20)\d{2}$", localized)
    if match:
        year = match.group(0).strip()
        localized = localized[: match.start()] + f" ({year})"
    return localized.strip()


def _classification_tensor(
    crop: np.ndarray,
    input_width: int,
    input_height: int,
    preserve_aspect: bool,
) -> np.ndarray:
    rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
    if preserve_aspect:
        source_height, source_width = rgb.shape[:2]
        scale = min(input_width / source_width, input_height / source_height)
        resized_width = max(1, round(source_width * scale))
        resized_height = max(1, round(source_height * scale))
        resized = cv2.resize(rgb, (resized_width, resized_height), interpolation=cv2.INTER_AREA)
        prepared = np.full((input_height, input_width, 3), 114, dtype=np.uint8)
        offset_x = (input_width - resized_width) // 2
        offset_y = (input_height - resized_height) // 2
        prepared[
            offset_y : offset_y + resized_height,
            offset_x : offset_x + resized_width,
        ] = resized
    else:
        prepared = cv2.resize(rgb, (input_width, input_height), interpolation=cv2.INTER_AREA)

    tensor = prepared.astype(np.float32) / 255.0
    tensor = (tensor - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array(
        [0.229, 0.224, 0.225], dtype=np.float32
    )
    return np.transpose(tensor, (2, 0, 1)).astype(np.float32)


def _softmax(values: np.ndarray, axis: int = -1) -> np.ndarray:
    shifted = values - np.max(values, axis=axis, keepdims=True)
    exponent = np.exp(shifted)
    return exponent / np.maximum(np.sum(exponent, axis=axis, keepdims=True), 1e-9)


def _cross_validate_body(crop: np.ndarray) -> dict[str, Any]:
    """Use the vehicle-only model as a second opinion for coarse body type."""
    if crop.size == 0 or not vehicle_model_ready():
        return {"available": False, "reliable": False}

    try:
        session = _load_vehicle_model()
        model_input = session.get_inputs()[0]
        tensor = _classification_tensor(crop, 560, 560, preserve_aspect=False)[None, ...]
        boxes, logits = session.run(
            ["det_boxes", "det_classes"], {model_input.name: tensor}
        )
    except Exception:
        return {"available": False, "reliable": False}

    boxes = np.asarray(boxes)[0]
    probabilities = _softmax(np.asarray(logits)[0], axis=1)
    centers_ok = (
        (boxes[:, 0] > 0.12)
        & (boxes[:, 0] < 0.88)
        & (boxes[:, 1] > 0.12)
        & (boxes[:, 1] < 0.88)
    )
    areas = np.clip(boxes[:, 2], 0, 1) * np.clip(boxes[:, 3], 0, 1)
    plausible = centers_ok & (areas > 0.08)
    row_scores = np.max(probabilities, axis=1) * np.clip(areas * 2.0, 0.2, 1.0)
    row_scores = np.where(plausible, row_scores, -1.0)
    query_index = int(np.argmax(row_scores))
    class_index = int(np.argmax(probabilities[query_index]))
    confidence = float(probabilities[query_index, class_index])
    return {
        "available": True,
        "name": VEHICLE_DINO_BODY_TYPES[class_index],
        "confidence": round(confidence * 100),
        "reliable": bool(plausible[query_index] and confidence >= 0.58),
    }


def _infer_usage(crop: np.ndarray, body_type: str) -> dict[str, Any]:
    """Conservative taxi cue detector; a trained usage model can replace this head."""
    if crop.size == 0 or body_type not in {"자동차", "승용차", "SUV"}:
        return {"name": "용도 미상", "confidence": 0, "reliable": False, "cue": None}

    height, width = crop.shape[:2]
    upper = crop[: max(1, round(height * 0.48))]
    gray = cv2.cvtColor(upper, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    threshold = max(150, int(np.percentile(blurred, 91)))
    mask = cv2.inRange(blurred, threshold, 255)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_score = 0.0
    crop_area = max(1, height * width)
    for contour in contours:
        x, y, box_width, box_height = cv2.boundingRect(contour)
        if box_height == 0:
            continue
        area_ratio = (box_width * box_height) / crop_area
        aspect = box_width / box_height
        center_x = (x + box_width / 2) / width
        center_y = (y + box_height / 2) / height
        if not (0.26 <= center_x <= 0.74 and 0.05 <= center_y <= 0.40):
            continue
        if not (1.25 <= aspect <= 5.5 and 0.001 <= area_ratio <= 0.035):
            continue
        rectangularity = cv2.contourArea(contour) / max(1, box_width * box_height)
        size_score = 1.0 - min(1.0, abs(area_ratio - 0.007) / 0.015)
        center_score = 1.0 - min(1.0, abs(center_x - 0.5) / 0.24)
        best_score = max(
            best_score,
            0.45 * rectangularity + 0.30 * size_score + 0.25 * center_score,
        )

    confidence = round(best_score * 100)
    if confidence >= 72:
        return {
            "name": "택시 추정",
            "confidence": confidence,
            "reliable": confidence >= 82,
            "cue": "차량 지붕 중앙에서 택시 표시등과 유사한 밝은 직사각형을 감지했습니다.",
        }
    return {
        "name": "일반/용도 미상",
        "confidence": round(100 - best_score * 45),
        "reliable": False,
        "cue": "택시·경찰차·구급차를 확정할 전용 학습 신호가 충분하지 않습니다.",
    }


def _product_body_compatible(search_name: str, body_type: str) -> bool:
    is_minivan = "minivan" in search_name.lower()
    if body_type == "밴":
        return is_minivan
    if body_type in {"승용차", "SUV", "자동차"}:
        return not is_minivan or body_type == "자동차"
    return False


def _inspection_region(crop: np.ndarray, stage: str) -> np.ndarray:
    height, width = crop.shape[:2]
    regions = {
        # Front and rear emblems are usually near the horizontal center. The
        # vertical range intentionally includes both grille and trunk badges.
        "logo": (0.30, 0.28, 0.70, 0.72),
        "bumper": (0.06, 0.56, 0.94, 0.98),
        "headlights": (0.04, 0.25, 0.96, 0.67),
        "exterior": (0.0, 0.0, 1.0, 1.0),
    }
    left, top, right, bottom = regions[stage]
    return crop[
        round(top * height) : max(round(top * height) + 1, round(bottom * height)),
        round(left * width) : max(round(left * width) + 1, round(right * width)),
    ]


def _region_visible(region: np.ndarray, stage: str) -> bool:
    if region.size == 0:
        return False
    height, width = region.shape[:2]
    minimum_sizes = {
        "logo": (64, 40),
        "bumper": (96, 42),
        "headlights": (96, 42),
        "exterior": (1, 1),
    }
    minimum_width, minimum_height = minimum_sizes[stage]
    if width < minimum_width or height < minimum_height:
        return False
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    contrast = float(np.std(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    usable_exposure = float(np.mean((gray > 20) & (gray < 245)))
    return contrast >= 11 and sharpness >= 14 and usable_exposure >= 0.42


def _classify_product(crops: list[np.ndarray]) -> list[dict[str, Any]]:
    crops = [crop for crop in crops if crop.size > 0]
    if not crops or not classifier_ready():
        return []
    session, labels = _load_classifier()
    model_input = session.get_inputs()[0]
    shape = model_input.shape
    input_height = shape[2] if isinstance(shape[2], int) else 224
    input_width = shape[3] if isinstance(shape[3], int) else 224

    stage_specs = [
        ("logo", "로고", 0.18),
        ("bumper", "범퍼", 0.10),
        ("headlights", "헤드라이트", 0.12),
        ("exterior", "전체 외관", 0.60),
    ]
    variants: list[np.ndarray] = []
    stage_ranges: list[tuple[str, str, float, int, int, bool]] = []
    for stage_key, stage_label, weight in stage_specs:
        start = len(variants)
        visible = stage_key == "exterior"
        for crop in crops:
            region = _inspection_region(crop, stage_key)
            if stage_key != "exterior" and not _region_visible(region, stage_key):
                continue
            visible = True
            aspect_preserved = _classification_tensor(
                region, input_width, input_height, preserve_aspect=True
            )
            stretched = _classification_tensor(
                region, input_width, input_height, preserve_aspect=False
            )
            variants.extend((aspect_preserved, stretched))
            if stage_key == "exterior":
                variants.append(np.flip(stretched, axis=2).copy())
        stage_ranges.append(
            (stage_key, stage_label, weight, start, len(variants), visible)
        )

    batch = np.stack(variants).astype(np.float32)
    logits = np.asarray(session.run(None, {model_input.name: batch})[0])
    logits -= np.max(logits, axis=1, keepdims=True)
    variant_probabilities = np.exp(logits)
    variant_probabilities /= np.sum(variant_probabilities, axis=1, keepdims=True)
    stage_probabilities: list[tuple[float, np.ndarray]] = []
    inspection_stages: list[dict[str, Any]] = []
    for stage_key, stage_label, weight, start, end, visible in stage_ranges:
        if not visible or end <= start:
            inspection_stages.append(
                {"key": stage_key, "label": stage_label, "visible": False}
            )
            continue
        stage_probability = np.mean(variant_probabilities[start:end], axis=0)
        stage_probabilities.append((weight, stage_probability))
        inspection_stages.append(
            {
                "key": stage_key,
                "label": stage_label,
                "visible": True,
                "confidence": round(float(np.max(stage_probability)) * 100),
            }
        )

    total_weight = sum(weight for weight, _ in stage_probabilities)
    probabilities = sum(
        weight * stage_probability
        for weight, stage_probability in stage_probabilities
    ) / max(total_weight, 1e-9)
    top_indices = np.argsort(probabilities)[-3:][::-1]
    top_one = float(probabilities[top_indices[0]])
    margin = top_one - float(probabilities[top_indices[1]])
    variant_winners = np.argmax(variant_probabilities, axis=1)
    agreement = float(np.mean(variant_winners == top_indices[0]))
    source_height, source_width = crops[0].shape[:2]
    minimum_edge = min(source_height, source_width)
    pixel_area = source_height * source_width
    sharpness = float(
        cv2.Laplacian(cv2.cvtColor(crops[0], cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()
    )
    quality_ready = minimum_edge >= 96 and pixel_area >= 18000 and sharpness >= 18
    # With 196 closed-set classes, a weak top score can look plausible even
    # when the real vehicle is not in the training set. Prefer abstention.
    reliable = (
        quality_ready
        and top_one >= 0.38
        and margin >= 0.10
        and agreement >= 0.67
    )
    return [
        {
            "name": _localize_product_name(labels[int(class_index)]),
            "confidence": round(float(probabilities[class_index]) * 100),
            "searchName": labels[int(class_index)],
            "reliable": reliable,
            "inspectionStages": inspection_stages,
        }
        for class_index in top_indices
    ]


def _vehicle_result(
    detection: Detection,
    frame: np.ndarray,
    index: int,
    night_mode: bool = False,
    classification_frames: list[np.ndarray] | None = None,
) -> dict[str, Any]:
    height, width = frame.shape[:2]
    x1, y1, x2, y2 = detection.box
    x1, x2 = max(0, x1), min(width, x2)
    y1, y2 = max(0, y1), min(height, y2)
    label = VEHICLE_CLASSES[detection.class_id]
    confidence = round(detection.confidence * 100)
    crop = frame[y1:y2, x1:x2]
    color = _color_name(crop, night_mode)
    padding_x = round((x2 - x1) * 0.1)
    padding_y = round((y2 - y1) * 0.1)
    expanded_x1 = max(0, x1 - padding_x)
    expanded_y1 = max(0, y1 - padding_y)
    expanded_x2 = min(width, x2 + padding_x)
    expanded_y2 = min(height, y2 + padding_y)
    product_crops = [
        source[expanded_y1:expanded_y2, expanded_x1:expanded_x2]
        for source in (classification_frames or [frame])
    ]
    body_cross_check = (
        _cross_validate_body(product_crops[0])
        if detection.class_id in {2, 5, 7}
        else {"available": False, "reliable": False}
    )
    body_type = label
    if body_cross_check.get("reliable"):
        cross_name = str(body_cross_check["name"])
        if detection.class_id == 2 or cross_name == label:
            body_type = cross_name

    classified = (
        _classify_product(product_crops)
        if body_type in {"자동차", "승용차", "SUV", "밴"}
        else []
    )
    body_compatible = bool(
        classified
        and _product_body_compatible(str(classified[0]["searchName"]), body_type)
    )
    product_reliable = bool(
        classified and classified[0]["reliable"] and body_compatible
    )
    candidates = [
        {"name": candidate["name"], "confidence": candidate["confidence"]}
        for candidate in classified
    ]
    inspection_stages = (
        classified[0].get("inspectionStages", []) if classified else []
    )
    inspection_summary = " → ".join(
        f"{stage['label']} {'확인' if stage['visible'] else '건너뜀'}"
        for stage in inspection_stages
    )
    product_name = (
        candidates[0]["name"]
        if candidates and product_reliable
        else f"{body_type} (세부 모델 판별 보류)"
    )
    usage = _infer_usage(crop, body_type)
    usage_prefix = "택시 " if usage["name"] == "택시 추정" else ""
    reference_image = (
        lookup_vehicle_image(str(classified[0]["searchName"]))
        if classified
        else None
    )
    return {
        "id": f"VEH_{index + 1:02d}",
        "description": f"{color} {usage_prefix}{product_name}",
        "confidence": confidence,
        "color": color,
        "bodyType": body_type,
        "usageType": usage["name"],
        "usageConfidence": usage["confidence"],
        "usageReliable": usage["reliable"],
        "bodyCrossCheck": body_cross_check,
        "inspectionStages": inspection_stages,
        "box": {
            "left": round(x1 / width * 100, 2),
            "top": round(y1 / height * 100, 2),
            "width": round((x2 - x1) / width * 100, 2),
            "height": round((y2 - y1) / height * 100, 2),
        },
        "candidates": candidates or [{"name": body_type, "confidence": confidence}],
        "productReliable": product_reliable,
        "referenceImage": reference_image,
        "evidence": [
            "로컬 YOLO 객체 탐지 모델이 차량 윤곽을 검출했습니다.",
            (
                "야간 노이즈 제거, 암부 톤 매핑, 과노출 억제와 디블러링을 적용했습니다."
                if night_mode
                else "톤 매핑과 디블러링이 적용된 프레임에서 분석했습니다."
            ),
            f"차량 영역의 색상 통계는 {color}으로 추정됩니다.",
            (
                f"차량 전용 모델 교차검증 결과는 {body_cross_check['name']} "
                f"({body_cross_check['confidence']}%)입니다."
                if body_cross_check.get("available")
                else "차량 전용 차체 교차검증 모델을 사용할 수 없어 YOLO 분류를 유지했습니다."
            ),
            str(usage["cue"]),
            (
                f"제품명 판별 순서: {inspection_summary}."
                if inspection_summary
                else "제품명 판별 부위를 확인할 수 없어 세부 분석을 건너뛰었습니다."
            ),
            *(
                [f"원본·보정본 앙상블의 제품명 Top-1은 {product_name}입니다."]
                if candidates and product_reliable
                else [
                    "제품명 후보의 신뢰도 또는 차체 종류와의 일치가 부족해 세부 모델명을 확정하지 않았습니다."
                ]
            ),
        ],
    }


def analyze(data: bytes, filename: str, content_type: str) -> dict[str, Any]:
    is_video = content_type.startswith("video/") or Path(filename).suffix.lower() in {
        ".mp4", ".mov", ".avi", ".mkv", ".webm"
    }
    if is_video:
        frames = _decode_video(data, Path(filename).suffix or ".mp4")
        base_frame = fuse_frames(frames)
    else:
        base_frame = _decode_image(data)

    night_mode = is_night_scene(base_frame)
    if night_mode:
        enhanced = deblur(night_tone_map(base_frame), iterations=3)
        classification_frames = [base_frame, enhanced]
    else:
        toned = tone_map(base_frame)
        enhanced = deblur(toned)
        classification_frames = [base_frame, toned]
    detections = _detect(enhanced, confidence_threshold=0.18 if night_mode else 0.25)
    if night_mode and not detections:
        # A conservative alternate exposure can recover silhouettes when the
        # stronger night enhancement changes the detector's expected contrast.
        detections = _detect(tone_map(base_frame), confidence_threshold=0.18)
    vehicles = [
        _vehicle_result(
            detection,
            enhanced,
            index,
            night_mode,
            classification_frames,
        )
        for index, detection in enumerate(detections)
    ]
    ok, encoded = cv2.imencode(".jpg", enhanced, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise RuntimeError("복원 이미지를 인코딩할 수 없습니다.")

    return {
        "summary": (
            f"야간 복원 분석으로 차량 {len(vehicles)}대를 감지했습니다."
            if night_mode
            else f"로컬 분석으로 차량 {len(vehicles)}대를 감지했습니다."
        ),
        "vehicles": vehicles,
        "enhancedImage": "data:image/jpeg;base64,"
        + base64.b64encode(encoded.tobytes()).decode("ascii"),
    }
