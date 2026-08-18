import logging
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.core.database import get_database
from app.services.face_service import generate_encoding, compare_faces, detect_face

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/face", tags=["Face Recognition"])

# Max upload size: 10 MB
MAX_IMAGE_BYTES = 10 * 1024 * 1024


async def _read_image(image: UploadFile) -> bytes:
    data = await image.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image files are accepted")
    return data


# ─────────────────────────────────────────────────────────────────
# POST /api/face/detect  — fast bbox, no DB lookup
# ─────────────────────────────────────────────────────────────────
@router.post("/detect")
async def detect_faces(
    image: UploadFile = File(..., description="Camera frame for face detection"),
):
    image_bytes = await _read_image(image)
    return detect_face(image_bytes)


# ─────────────────────────────────────────────────────────────────
# POST /api/face/register
# ─────────────────────────────────────────────────────────────────
@router.post("/register", status_code=201)
async def register_employee(
    employee_id: str  = Form(..., min_length=1, max_length=50),
    name:        str  = Form(..., min_length=1, max_length=100),
    department:  str  = Form(..., min_length=1, max_length=100),
    image: UploadFile = File(..., description="Upload one face image"),
):
    image_bytes = await _read_image(image)
    enc_result  = generate_encoding(image_bytes)

    if not enc_result["success"]:
        raise HTTPException(status_code=422, detail=enc_result["message"])

    db  = get_database()
    col = db["employees"]
    existing = await col.find_one({"employee_id": employee_id})

    if existing is None:
        await col.insert_one({
            "employee_id": employee_id,
            "name":        name,
            "department":  department,
            "encodings":   [enc_result["encoding"]],
            "created_at":  datetime.now(timezone.utc),
            "updated_at":  datetime.now(timezone.utc),
        })
        count = 1
    else:
        encodings = existing["encodings"]
        if len(encodings) >= 3:
            raise HTTPException(
                status_code=409,
                detail="Employee already has 3 registered images. Delete first to re-register.",
            )
        encodings.append(enc_result["encoding"])
        await col.update_one(
            {"employee_id": employee_id},
            {"$set": {
                "encodings":  encodings,
                "name":       name,
                "department": department,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        count = len(encodings)

    logger.info("Registered image %d/3 for employee %s", count, employee_id)
    return {
        "message":               f"Image {count}/3 registered successfully",
        "employee_id":           employee_id,
        "name":                  name,
        "department":            department,
        "images_registered":     count,
        "registration_complete": count >= 3,
    }


# ─────────────────────────────────────────────────────────────────
# POST /api/face/recognize
# ─────────────────────────────────────────────────────────────────
@router.post("/recognize")
async def recognize_employee(
    image: UploadFile = File(..., description="Face image for recognition"),
):
    image_bytes = await _read_image(image)
    enc_result  = generate_encoding(image_bytes)

    if not enc_result["success"]:
        raise HTTPException(status_code=422, detail=enc_result["message"])

    query_encoding = enc_result["encoding"]
    db = get_database()

    best_match:      dict | None = None
    best_similarity: float       = -1.0

    async for emp in db["employees"].find():
        for stored_enc in emp["encodings"]:
            cmp = compare_faces(query_encoding, stored_enc)
            if cmp["similarity"] > best_similarity:
                best_similarity = cmp["similarity"]
                if cmp["matched"]:
                    best_match = emp

    now_str = datetime.now().strftime("%d %b %Y  %I:%M:%S %p")

    if best_match:
        log_doc = {
            "employee_id": best_match["employee_id"],
            "name":        best_match["name"],
            "department":  best_match["department"],
            "time":        now_str,
            "timestamp":   datetime.now(timezone.utc),
            "status":      "Matched",
            "similarity":  round(best_similarity, 4),
        }
        await db["recognition_log"].insert_one(log_doc)
        logger.info("Recognized employee %s (similarity=%.4f)", best_match["employee_id"], best_similarity)
        return {
            "matched":     True,
            "employee_id": best_match["employee_id"],
            "name":        best_match["name"],
            "department":  best_match["department"],
            "time":        now_str,
            "similarity":  round(best_similarity, 4),
        }

    log_doc = {
        "employee_id": "—",
        "name":        "Unknown",
        "department":  "—",
        "time":        now_str,
        "timestamp":   datetime.now(timezone.utc),
        "status":      "Unknown",
        "similarity":  round(best_similarity, 4),
    }
    await db["recognition_log"].insert_one(log_doc)
    logger.info("Unknown face (best similarity=%.4f)", best_similarity)
    return {
        "matched":    False,
        "name":       "Unknown",
        "time":       now_str,
        "similarity": round(best_similarity, 4),
    }


# ─────────────────────────────────────────────────────────────────
# GET /api/face/log
# ─────────────────────────────────────────────────────────────────
@router.get("/log")
async def get_recognition_log(limit: int = 20):
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")
    db   = get_database()
    docs = await db["recognition_log"].find(
        {}, {"_id": 0, "timestamp": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"log": docs}


# ─────────────────────────────────────────────────────────────────
# GET /api/face/employees
# ─────────────────────────────────────────────────────────────────
@router.get("/employees")
async def get_employees():
    db   = get_database()
    docs = await db["employees"].find(
        {}, {"_id": 0, "encodings": 0}
    ).to_list(500)
    return {"employees": docs}


# ─────────────────────────────────────────────────────────────────
# DELETE /api/face/employees/{employee_id}
# ─────────────────────────────────────────────────────────────────
@router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str):
    db     = get_database()
    result = await db["employees"].delete_one({"employee_id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    logger.info("Deleted employee %s", employee_id)
    return {"message": f"Employee {employee_id} deleted"}
