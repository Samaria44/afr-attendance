import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis

# Singleton — loaded once on startup
_face_app = None


def get_face_app():
    global _face_app
    if _face_app is None:
        _face_app = FaceAnalysis(
            name="buffalo_sc",          # lightweight model: detector + ArcFace
            providers=["CPUExecutionProvider"]
        )
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app


def _decode_image(image_bytes: bytes):
    image_array = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    return image


def detect_face(image_bytes: bytes):
    image = _decode_image(image_bytes)

    if image is None:
        return {"success": False, "message": "Invalid image file"}

    app = get_face_app()
    faces = app.get(image)

    return {
        "success": True,
        "face_detected": len(faces) > 0,
        "number_of_faces": len(faces)
    }


def generate_encoding(image_bytes: bytes):
    """
    Returns a 512-dim ArcFace embedding for the face in the image.
    Uses InsightFace buffalo_sc model (ONNX, no dlib/cmake required).
    """
    image = _decode_image(image_bytes)

    if image is None:
        return {"success": False, "message": "Invalid image file"}

    app = get_face_app()
    faces = app.get(image)

    if len(faces) == 0:
        return {"success": False, "message": "No face found in image"}

    if len(faces) > 1:
        return {"success": False, "message": "Multiple faces found — please upload a single face image"}

    embedding = faces[0].normed_embedding  # 512-dim unit vector

    return {
        "success": True,
        "encoding": embedding.tolist(),
        "encoding_length": len(embedding)
    }


def compare_faces(encoding1: list, encoding2: list, threshold: float = 0.4) -> dict:
    """
    Cosine similarity between two ArcFace embeddings.
    Threshold 0.4 is a good default for buffalo_sc.
    """
    e1 = np.array(encoding1)
    e2 = np.array(encoding2)
    similarity = float(np.dot(e1, e2))   # both are already unit vectors
    matched = similarity >= threshold

    return {
        "matched": matched,
        "similarity": round(similarity, 4),
        "threshold": threshold
    }
