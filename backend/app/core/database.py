from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
from app.core.config import get_settings
import logging

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient = None


def get_database() -> AsyncIOMotorDatabase:
    settings = get_settings()
    return _client[settings.DB_NAME]


async def connect_db():
    global _client
    settings = get_settings()
    _client = AsyncIOMotorClient(
        settings.MONGO_URI,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
        socketTimeoutMS=10000,
    )
    db = _client[settings.DB_NAME]
    await _client.admin.command("ping")

    await db["employees"].create_index(
        [("employee_id", ASCENDING)], unique=True
    )
    await db["recognition_log"].create_index(
        [("timestamp", DESCENDING)]
    )
    await db["recognition_log"].create_index(
        [("employee_id", ASCENDING), ("timestamp", DESCENDING)]
    )
    await db["recognition_log"].create_index(
        [("status", ASCENDING), ("timestamp", DESCENDING)]
    )
    logger.info("Connected to MongoDB → %s", settings.DB_NAME)


async def close_db():
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed")
