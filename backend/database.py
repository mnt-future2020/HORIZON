from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as aioredis
import os
import logging

logger = logging.getLogger("horizon")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Redis
redis_url = os.environ.get('REDIS_URL')
redis_client: aioredis.Redis = None

# Lock config
SOFT_LOCK_TTL = 600      # 10 minutes
HARD_LOCK_TTL = 1800     # 30 minutes


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
            logger.info("Redis connected for slot locking")
        except Exception as e:
            logger.warning(f"Redis unavailable, slot locking disabled: {e}")
            redis_client = None


async def close_connections():
    global redis_client
    if redis_client:
        await redis_client.close()
    client.close()
