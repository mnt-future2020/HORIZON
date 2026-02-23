"""
Chat Message Encryption — AES-256-GCM
Encrypts chat messages at rest in the database.
Each conversation gets a unique derived key from the master secret.
"""
import os
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

# Master encryption key — derived from CHAT_ENCRYPTION_KEY env var or JWT_SECRET
_MASTER_KEY_SOURCE = os.environ.get("CHAT_ENCRYPTION_KEY") or os.environ.get("JWT_SECRET") or ""
_ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").strip().lower()

if not _MASTER_KEY_SOURCE:
    if _ENVIRONMENT == "production":
        raise RuntimeError("FATAL: CHAT_ENCRYPTION_KEY or JWT_SECRET must be set in production. All chat messages would be unencrypted!")
    import logging as _enc_logging
    _enc_logging.getLogger("horizon").warning("No encryption key set — using insecure dev-only key. NOT safe for production!")
    _MASTER_KEY_SOURCE = "dev-only-insecure-key-do-not-use-in-prod"

MASTER_KEY = hashlib.sha256(_MASTER_KEY_SOURCE.encode()).digest()  # 32 bytes = AES-256


def _derive_key_hkdf(conversation_id: str) -> bytes:
    """Derive key using proper HKDF (new standard)."""
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=conversation_id.encode("utf-8"),
    )
    return hkdf.derive(MASTER_KEY)


def _derive_key_legacy(conversation_id: str) -> bytes:
    """Legacy key derivation (SHA256 concatenation) — for decrypting old messages."""
    return hashlib.sha256(MASTER_KEY + conversation_id.encode()).digest()


def derive_conversation_key(conversation_id: str) -> bytes:
    """Derive a unique AES-256 key for each conversation.
    MEDIUM FIX: New messages use proper HKDF. Old messages fall back to legacy."""
    return _derive_key_hkdf(conversation_id)


def encrypt_message(plaintext: str, conversation_id: str) -> str:
    """Encrypt a plaintext message. Returns base64-encoded 'nonce:ciphertext'."""
    if not plaintext:
        return ""
    key = derive_conversation_key(conversation_id)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit nonce for GCM
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    # Format: base64(nonce + ciphertext)
    encrypted = base64.b64encode(nonce + ciphertext).decode("ascii")
    return f"ENC:{encrypted}"


def decrypt_message(encrypted: str, conversation_id: str) -> str:
    """Decrypt a message. Returns plaintext string.
    Tries HKDF-derived key first, falls back to legacy SHA256 key for old messages."""
    if not encrypted:
        return ""
    if not encrypted.startswith("ENC:"):
        return encrypted  # Not encrypted (legacy message), return as-is
    try:
        raw = base64.b64decode(encrypted[4:])
        nonce = raw[:12]
        ciphertext = raw[12:]
        # Try new HKDF key first
        try:
            key = _derive_key_hkdf(conversation_id)
            aesgcm = AESGCM(key)
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)
            return plaintext.decode("utf-8")
        except Exception:
            pass
        # Fall back to legacy key derivation for old messages
        key = _derive_key_legacy(conversation_id)
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode("utf-8")
    except Exception:
        return "[Encrypted message - decryption failed]"


def is_encrypted(text: str) -> bool:
    """Check if a message is encrypted."""
    return text.startswith("ENC:") if text else False
