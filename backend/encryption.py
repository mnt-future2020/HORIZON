"""
Chat Message Encryption — AES-256-GCM
Encrypts chat messages at rest in the database.
Each conversation gets a unique derived key from the master secret.
"""
import os
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Master encryption key — derived from CHAT_ENCRYPTION_KEY env var or JWT_SECRET
_MASTER_KEY_SOURCE = os.environ.get("CHAT_ENCRYPTION_KEY") or os.environ.get("JWT_SECRET") or "default-dev-key"
MASTER_KEY = hashlib.sha256(_MASTER_KEY_SOURCE.encode()).digest()  # 32 bytes = AES-256


def derive_conversation_key(conversation_id: str) -> bytes:
    """Derive a unique AES-256 key for each conversation using HKDF-like approach."""
    return hashlib.sha256(MASTER_KEY + conversation_id.encode()).digest()


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
    """Decrypt a message. Returns plaintext string."""
    if not encrypted:
        return ""
    if not encrypted.startswith("ENC:"):
        return encrypted  # Not encrypted (legacy message), return as-is
    try:
        raw = base64.b64decode(encrypted[4:])
        nonce = raw[:12]
        ciphertext = raw[12:]
        key = derive_conversation_key(conversation_id)
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode("utf-8")
    except Exception:
        return "[Encrypted message - decryption failed]"


def is_encrypted(text: str) -> bool:
    """Check if a message is encrypted."""
    return text.startswith("ENC:") if text else False
