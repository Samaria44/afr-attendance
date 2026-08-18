from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from datetime import datetime, timezone

from app.core.database import get_database
from app.services.face_service import generate_encoding, compare_faces, detect_face

router = APIRouter(prefix="/api/face", tags=["Face Recognition"])


# ─────────────────────────────────────────────
# POST /api/face/detect  (fast — no DB, just bbox)
# ─────────────────────────────────────────────
@router.post("/detect")
async def detect_faces(
    image: UploadFile = File(..., description="Camera frame for face detection"),
):
    image_bytes = await image.read()
    result = detect_face(image_bytes)
    return result


# ─────────────────────────────────────────────
# POST /api/face/register
# ─────────────────────────────────────────────
@router.post("/register")
async def register_employee(
    employee_id: str  = Form(...),
    name:        str  = Form(...),
    department:  str  = Form(...),
    image: UploadFile = File(..., description="Upload one face image"),
):
    image_bytes = await image.read()
    enc_result  = generate_encoding(image_bytes)

    if not enc_result["success"]:
        raise HTTPException(status_code=400, detail=enc_result["message"])

    db  = get_database()
    col = db["employees"]

    existing = await col.find_one({"employee_id": employee_id})

    if existing is None:
        # First image — create record
        await col.insert_one({
            "employee_id": employee_id,
            "name":        name,
            "department":  department,
            "encodings":   [enc_result["encoding"]],
            "created_at":  datetime.now(timezone.utc),
        })
        count = 1
    else:
        # Add encoding (cap at 3)
        encodings = existing["encodings"]
        if len(encodings) >= 3:
            raise HTTPException(
                status_code=400,
                detail="Employee already has 3 registered images. Delete first to re-register.",
            )
        encodings.append(enc_result["encoding"])
        await col.update_one(
            {"employee_id": employee_id},
            {"$set": {"encodings": encodings, "name": name, "department": department}},
        )
        count = len(encodings)

    return {
        "message":              f"Image {count}/3 registered successfully",
        "employee_id":          employee_id,
        "name":                 name,
        "department":           department,
        "images_registered":    count,
        "registration_complete": count >= 3,
    }


# ─────────────────────────────────────────────
# POST /api/face/recognize
# ─────────────────────────────────────────────
@router.post("/recognize")
async def recognize_employee(
    image: UploadFile = File(..., description="Face image for recognition"),
):
    image_bytes = await image.read()
    enc_result  = generate_encoding(image_bytes)

    if not enc_result["success"]:
        raise HTTPException(status_code=400, detail=enc_result["message"])

    query_encoding = enc_result["encoding"]
    db  = get_database()

    best_match:      dict | None = None
    best_similarity: float       = -1.0

    # Compare against every stored encoding
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

        return {
            "matched":     True,
            "employee_id": best_match["employee_id"],
            "name":        best_match["name"],
            "department":  best_match["department"],
            "time":        now_str,
            "similarity":  round(best_similarity, 4),
        }

    # Unknown
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

    return {
        "matched":    False,
        "name":       "Unknown",
        "time":       now_str,
        "similarity": round(best_similarity, 4),
    }


# ─────────────────────────────────────────────
# GET /api/face/log
# ─────────────────────────────────────────────
@router.get("/log")
async def get_recognition_log(limit: int = 20):
    db   = get_database()
    docs = await db["recognition_log"].find(
        {}, {"_id": 0, "timestamp": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"log": docs}


# ─────────────────────────────────────────────
# GET /api/face/employees
# ─────────────────────────────────────────────
@router.get("/employees")
async def get_employees():
    db   = get_database()
    docs = await db["employees"].find(
        {}, {"_id": 0, "encodings": 0}
    ).to_list(500)
    return {"employees": docs}


# ─────────────────────────────────────────────
# DELETE /api/face/employees/{employee_id}
# ─────────────────────────────────────────────
@router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str):
    db     = get_database()
    result = await db["employees"].delete_one({"employee_id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": f"Employee {employee_id} deleted"}
