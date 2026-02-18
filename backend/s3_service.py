import boto3
import logging
import uuid
from botocore.exceptions import ClientError
from botocore.config import Config
from database import db

logger = logging.getLogger("horizon")


async def get_s3_config():
    """Fetch S3 config from platform_settings DB."""
    settings = await db.platform_settings.find_one({"key": "platform"}, {"_id": 0})
    if not settings:
        return None
    s3 = settings.get("s3_storage", {})
    if not all([s3.get("access_key_id"), s3.get("secret_access_key"), s3.get("bucket_name"), s3.get("region")]):
        return None
    return s3


def _make_client(cfg: dict):
    return boto3.client(
        "s3",
        region_name=cfg["region"],
        aws_access_key_id=cfg["access_key_id"],
        aws_secret_access_key=cfg["secret_access_key"],
        config=Config(signature_version="s3v4"),
    )


def public_url(cfg: dict, key: str) -> str:
    return f"https://{cfg['bucket_name']}.s3.{cfg['region']}.amazonaws.com/{key}"


async def upload_bytes(content: bytes, folder: str, filename: str, content_type: str) -> str | None:
    """Upload bytes to S3. Returns public URL or None if S3 not configured."""
    cfg = await get_s3_config()
    if not cfg:
        return None
    key = f"{folder}/{uuid.uuid4().hex}_{filename}"
    try:
        client = _make_client(cfg)
        client.put_object(
            Bucket=cfg["bucket_name"],
            Key=key,
            Body=content,
            ContentType=content_type,
        )
        url = public_url(cfg, key)
        logger.info(f"S3 upload OK: {url}")
        return url
    except ClientError as e:
        logger.error(f"S3 upload failed: {e}")
        return None


async def test_connection(cfg: dict) -> dict:
    """Test S3 connectivity. Returns {ok, message}."""
    try:
        client = _make_client(cfg)
        client.head_bucket(Bucket=cfg["bucket_name"])
        return {"ok": True, "message": f"Connected to s3://{cfg['bucket_name']} ({cfg['region']})"}
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "403":
            return {"ok": False, "message": "Access denied — check IAM permissions"}
        if code == "404":
            return {"ok": False, "message": "Bucket not found — check bucket name"}
        return {"ok": False, "message": str(e)}
    except Exception as e:
        return {"ok": False, "message": str(e)}
