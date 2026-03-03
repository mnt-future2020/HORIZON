from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as aioredis
import ssl
import os
import logging
from pymongo.errors import (
    AutoReconnect, ConnectionFailure, ServerSelectionTimeoutError,
    NetworkTimeout, NotPrimaryError
)
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger("horizon")

mongo_url = os.environ.get('MONGO_URL') or os.environ.get('DATABASE_URL', 'mongodb://localhost:27017')
# HIGH FIX: Configure connection pool + timeout for production readiness
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=50,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000,
    connect=False,
)
db = client[os.environ.get('DB_NAME', 'lobbi_db')]

# Redis
redis_url = os.environ.get('REDIS_URL') or os.environ.get('REDIS_PRIVATE_URL')
redis_client: aioredis.Redis = None

# HIGH FIX: Explicitly warn when Redis is not configured — slot locking will be disabled
if not redis_url:
    logger.warning("REDIS_URL not set — slot locking, rate limiting, and caching will be DISABLED. "
                    "Set REDIS_URL for production use.")

# Lock config
SOFT_LOCK_TTL = 600      # 10 minutes
HARD_LOCK_TTL = 1800     # 30 minutes


# Retry decorator for transient MongoDB failures (network blips, Atlas maintenance)
TRANSIENT_ERRORS = (AutoReconnect, ConnectionFailure, ServerSelectionTimeoutError, NetworkTimeout, NotPrimaryError)

db_retry = retry(
    retry=retry_if_exception_type(TRANSIENT_ERRORS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    reraise=True,
)


def lock_key(venue_id: str, date: str, start_time: str, turf: int) -> str:
    return f"lock:{venue_id}:{date}:{start_time}:{turf}"


def get_redis():
    return redis_client


async def init_redis():
    global redis_client
    if redis_url:
        try:
            # Upstash uses rediss:// (TLS) — library handles SSL automatically
            kwargs = {"decode_responses": False}
            if redis_url.startswith("rediss://"):
                kwargs["ssl_cert_reqs"] = None
            redis_client = aioredis.from_url(redis_url, **kwargs)
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
