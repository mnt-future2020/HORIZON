from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as aioredis
import os
import logging

logger = logging.getLogger("horizon")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

redis_url = os.environ.get('REDIS_URL')
redis_client: aioredis.Redis = None


async def init_redis():
    global redis_client
    if redis_url:
        try:
            redis_client = aioredis.from_url(redis_url, decode_responses=True)
            await redis_client.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.warning(f"Redis not available: {e}")
            redis_client = None


async def close_connections():
    global redis_client
    if redis_client:
        await redis_client.close()
    client.close()
