from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME",   "afr_attendance")

_client: AsyncIOMotorClient = None


def get_database() -> AsyncIOMotorDatabase:
    return _client[DB_NAME]


async def connect_db():
    global _client
    _client = AsyncIOMotorClient(MONGO_URI)

    db = _client[DB_NAME]

    # Ping to verify connection is actually alive
    await _client.admin.command("ping")

    # Create indexes using the async motor API
    await db["employees"].create_index(
        [("employee_id", ASCENDING)], unique=True
    )
    await db["recognition_log"].create_index(
        [("timestamp", DESCENDING)]
    )

    print(f" Connected to MongoDB  →  {MONGO_URI}  /  {DB_NAME}")


async def close_db():
    global _client
    if _client:
        _client.close()
        print("🔌 MongoDB connection closed")
