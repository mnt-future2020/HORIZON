"""Shared database connection module for all microservices."""
from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as aioredis
import os
import logging

logger = logging.getLogger("horizon")

mongo_url = os.environ.get('MONGO_URL', 'mongodb://mongo:27017')
db_name = os.environ.get('DB_NAME', 'horizon')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Redis
redis_url = os.environ.get('REDIS_URL', 'redis://redis:6379')
redis_client: aioredis.Redis = None

SOFT_LOCK_TTL = 600
HARD_LOCK_TTL = 1800


def lock_key(venue_id: str, date: str, start_time: str, turf: int) -> str:
    return f"lock:{venue_id}:{date}:{start_time}:{turf}"


def get_redis():
    return redis_client


async def init_redis():
    global redis_client
    if redis_url:
        try:
            redis_client = aioredis.from_url(redis_url, decode_responses=False)
            await redis_client.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.warning(f"Redis unavailable: {e}")
            redis_client = None


async def close_connections():
    global redis_client
    if redis_client:
        await redis_client.close()
    client.close()
