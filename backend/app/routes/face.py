import logging
from datetime import datetime, timezone, timedelta, date
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query

from app.core.database import get_database
from app.core.deps import require_permission
from app.services.face_service import generate_encoding, compare_faces, detect_face

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/face", tags=["Face Recognition"])

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
    image: UploadFile = File(...),
    _user = Depends(require_permission("face:detect")),
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
    image: UploadFile = File(...),
    _user = Depends(require_permission("face:register_employee")),
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
    image: UploadFile = File(...),
    threshold: Optional[float] = Form(None),
    attendance_mode: Optional[str] = Form(None),
    _user = Depends(require_permission("face:recognize")),
):
    image_bytes = await _read_image(image)
    enc_result  = generate_encoding(image_bytes)

    if not enc_result["success"]:
        raise HTTPException(status_code=422, detail=enc_result["message"])

    query_encoding = enc_result["encoding"]
    db = get_database()

    # Use provided threshold or default to 0.4
    similarity_threshold = threshold if threshold is not None else 0.4

    best_match:      dict | None = None
    best_similarity: float       = -1.0

    async for emp in db["employees"].find():
        for stored_enc in emp["encodings"]:
            cmp = compare_faces(query_encoding, stored_enc, similarity_threshold)
            if cmp["similarity"] > best_similarity:
                best_similarity = cmp["similarity"]
                if cmp["matched"]:
                    best_match = emp

    now_str = datetime.now().strftime("%d %b %Y  %I:%M:%S %p")

    if best_match:
        db = get_database()

        # ── Check-in / Check-out logic ────────────────────────────
        # Find last event for this employee today
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        last_event = await db["recognition_log"].find_one(
            {
                "employee_id": best_match["employee_id"],
                "status": "Matched",
                "timestamp": {"$gte": today_start},
            },
            sort=[("timestamp", -1)],
        )

        # Determine event type based on attendance mode
        CHECKOUT_DELAY = timedelta(minutes=1)
        now_utc = datetime.now(timezone.utc)

        # If manual mode, just log recognition without check-in/check-out logic
        if attendance_mode == "manual":
            event_type = "unknown"
        else:
            # Auto mode: determine check-in/check-out
            if last_event is None:
                event_type = "check_in"
            elif last_event.get("type") == "check_in":
                elapsed = now_utc - last_event["timestamp"].replace(tzinfo=timezone.utc) if last_event["timestamp"].tzinfo is None else now_utc - last_event["timestamp"]
                if elapsed >= CHECKOUT_DELAY:
                    event_type = "check_out"
                else:
                    # Too soon — already checked in, ignore duplicate
                    remaining = int((CHECKOUT_DELAY - elapsed).total_seconds())
                    return {
                        "matched":     True,
                        "employee_id": best_match["employee_id"],
                        "name":        best_match["name"],
                        "department":  best_match["department"],
                        "time":        now_str,
                        "similarity":  round(best_similarity, 4),
                        "type":        "already_checked_in",
                        "message":     f"Already checked in. Checkout available in {remaining}s",
                    }
            else:
                # Last event was check_out → next is a new check_in
                event_type = "check_in"

        log_doc = {
            "employee_id": best_match["employee_id"],
            "name":        best_match["name"],
            "department":  best_match["department"],
            "time":        now_str,
            "timestamp":   now_utc,
            "status":      "Matched",
            "type":        event_type,
            "similarity":  round(best_similarity, 4),
        }
        await db["recognition_log"].insert_one(log_doc)
        logger.info("%s: %s (similarity=%.4f)", event_type, best_match["employee_id"], best_similarity)

        return {
            "matched":     True,
            "employee_id": best_match["employee_id"],
            "name":        best_match["name"],
            "department":  best_match["department"],
            "time":        now_str,
            "similarity":  round(best_similarity, 4),
            "type":        event_type,
        }

    log_doc = {
        "employee_id": "—",
        "name":        "Unknown",
        "department":  "—",
        "time":        now_str,
        "timestamp":   datetime.now(timezone.utc),
        "status":      "Unknown",
        "type":        "unknown",
        "similarity":  round(best_similarity, 4),
    }
    await db["recognition_log"].insert_one(log_doc)
    logger.info("Unknown face (best similarity=%.4f)", best_similarity)
    return {
        "matched":    False,
        "name":       "Unknown",
        "time":       now_str,
        "similarity": round(best_similarity, 4),
        "type":       "unknown",
    }


# ─────────────────────────────────────────────────────────────────
# GET /api/face/log
# ─────────────────────────────────────────────────────────────────
@router.get("/log")
async def get_recognition_log(limit: int = 20, _user = Depends(require_permission("face:view_log"))):
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 200")
    db   = get_database()
    docs = await db["recognition_log"].find(
        {}, {"_id": 0, "timestamp": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"log": docs}


# ─────────────────────────────────────────────────────────────────
# GET /api/face/employees
# ─────────────────────────────────────────────────────────────────
@router.get("/employees")
async def get_employees(_user = Depends(require_permission("face:view_employees"))):
    db   = get_database()
    docs = await db["employees"].find(
        {}, {"_id": 0, "encodings": 0}
    ).to_list(500)
    return {"employees": docs}


# ─────────────────────────────────────────────────────────────────
# DELETE /api/face/employees/{employee_id}
# ─────────────────────────────────────────────────────────────────
@router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, _user = Depends(require_permission("face:delete_employee"))):
    db     = get_database()
    result = await db["employees"].delete_one({"employee_id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    logger.info("Deleted employee %s", employee_id)
    return {"message": f"Employee {employee_id} deleted"}


# ─────────────────────────────────────────────────────────────────
# GET /api/face/attendance
# Returns check-in/check-out sessions grouped by employee per day.
# Query params:
#   date_from  — ISO date string e.g. "2024-01-20"  (default: today)
#   date_to    — ISO date string e.g. "2024-01-27"  (default: today)
#   employee_id — filter by specific employee (optional)
# ─────────────────────────────────────────────────────────────────
@router.get("/attendance")
async def get_attendance(
    date_from:   Optional[str] = Query(None, description="ISO date YYYY-MM-DD (default: today)"),
    date_to:     Optional[str] = Query(None, description="ISO date YYYY-MM-DD (default: today)"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    _user = Depends(require_permission("face:view_log")),
):
    now_utc = datetime.now(timezone.utc)
    today   = now_utc.date()

    try:
        start_date = date.fromisoformat(date_from) if date_from else today
        end_date   = date.fromisoformat(date_to)   if date_to   else today
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if start_date > end_date:
        start_date, end_date = end_date, start_date

    start_dt = datetime(start_date.year, start_date.month, start_date.day,  0,  0,  0, tzinfo=timezone.utc)
    end_dt   = datetime(end_date.year,   end_date.month,   end_date.day,   23, 59, 59, tzinfo=timezone.utc)

    query: dict = {
        "status":    "Matched",
        "type":      {"$in": ["check_in", "check_out"]},
        "timestamp": {"$gte": start_dt, "$lte": end_dt},
    }
    if employee_id:
        query["employee_id"] = employee_id

    db   = get_database()
    docs = await db["recognition_log"].find(
        query, {"_id": 0}
    ).sort("timestamp", 1).to_list(2000)

    # ── Group into sessions (check_in + optional check_out pairs) ──
    # Key: (employee_id, date_str)
    # Each session starts with a check_in and is closed by the next check_out
    sessions: dict[tuple, list] = {}

    for doc in docs:
        ts  = doc["timestamp"]
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        day_key = ts.date().isoformat()
        key     = (doc["employee_id"], day_key)
        sessions.setdefault(key, []).append(doc)

    results = []
    for (emp_id, day_str), events in sessions.items():
        # Build paired sessions
        paired: list[dict] = []
        i = 0
        while i < len(events):
            ev = events[i]
            if ev["type"] == "check_in":
                ci_ts = ev["timestamp"]
                if ci_ts.tzinfo is None: ci_ts = ci_ts.replace(tzinfo=timezone.utc)
                session: dict = {
                    "check_in_time":  ci_ts.strftime("%I:%M %p"),
                    "check_in_ts":    ci_ts.isoformat(),
                    "check_out_time": None,
                    "check_out_ts":   None,
                    "duration_min":   None,
                }
                # Peek for the matching check_out
                if i + 1 < len(events) and events[i + 1]["type"] == "check_out":
                    co = events[i + 1]
                    co_ts = co["timestamp"]
                    if co_ts.tzinfo is None: co_ts = co_ts.replace(tzinfo=timezone.utc)
                    dur = int((co_ts - ci_ts).total_seconds() // 60)
                    session["check_out_time"] = co_ts.strftime("%I:%M %p")
                    session["check_out_ts"]   = co_ts.isoformat()
                    session["duration_min"]   = dur
                    i += 2
                else:
                    i += 1
                paired.append(session)
            else:
                # Orphan check_out (shouldn't happen, but handle gracefully)
                i += 1

        # Sum up total minutes worked
        total_min = sum(s["duration_min"] for s in paired if s["duration_min"] is not None)
        first_in  = paired[0]["check_in_ts"]  if paired else None
        last_out  = next((s["check_out_ts"] for s in reversed(paired) if s["check_out_ts"]), None)

        # Get name/department from first event
        first = events[0]
        results.append({
            "employee_id": emp_id,
            "name":        first.get("name", ""),
            "department":  first.get("department", ""),
            "date":        day_str,
            "sessions":    paired,
            "total_sessions": len(paired),
            "total_min":   total_min,
            "first_check_in":  first_in,
            "last_check_out":  last_out,
            "status": "present",
        })

    # Sort by date desc, then name asc
    results.sort(key=lambda r: (r["date"], r["name"]), reverse=False)
    results.sort(key=lambda r: r["date"], reverse=True)

    return {
        "attendance":  results,
        "date_from":   start_date.isoformat(),
        "date_to":     end_date.isoformat(),
        "total_records": len(results),
    }


# ─────────────────────────────────────────────────────────────────
# GET /api/face/attendance/today-summary
# Returns a quick summary: who is currently checked-in right now.
# ─────────────────────────────────────────────────────────────────
@router.get("/attendance/today-summary")
async def get_today_summary(_user = Depends(require_permission("face:view_log"))):
    now_utc     = datetime.now(timezone.utc)
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)

    db   = get_database()
    docs = await db["recognition_log"].find(
        {
            "status":    "Matched",
            "type":      {"$in": ["check_in", "check_out"]},
            "timestamp": {"$gte": today_start},
        },
        {"_id": 0}
    ).sort("timestamp", 1).to_list(2000)

    # Latest event per employee
    latest: dict[str, dict] = {}
    for doc in docs:
        latest[doc["employee_id"]] = doc

    checked_in  = [d for d in latest.values() if d["type"] == "check_in"]
    checked_out = [d for d in latest.values() if d["type"] == "check_out"]

    # Total unique employees seen today
    total_today = len(latest)

    return {
        "checked_in_count":  len(checked_in),
        "checked_out_count": len(checked_out),
        "total_today":       total_today,
        "currently_in":      [
            {
                "employee_id": d["employee_id"],
                "name":        d.get("name", ""),
                "department":  d.get("department", ""),
                "check_in_ts": d["timestamp"].isoformat() if hasattr(d["timestamp"], "isoformat") else d["timestamp"],
                "time":        d.get("time", ""),
            }
            for d in checked_in
        ],
    }
