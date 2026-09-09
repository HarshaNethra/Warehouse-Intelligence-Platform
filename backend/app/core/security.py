import os
import json
import time
import hmac
import hashlib
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

# JWT Security Configurations
SECRET_KEY = os.getenv("SECRET_KEY", "WMS_GODREJ_SURVEILLANCE_SECRET_KEY_2026_PRODUCTION")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 Hours


def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')


def base64url_decode(data_str: str) -> bytes:
    padding = '=' * (4 - (len(data_str) % 4))
    return base64.urlsafe_b64decode((data_str + padding).encode('utf-8'))


def get_password_hash(password: str) -> str:
    """
    Hashes plain text password using PBKDF2-HMAC-SHA256 with random 16-byte salt.
    Format: pbkdf2_sha256$iterations$salt_hex$hash_hex
    """
    salt = os.urandom(16)
    iterations = 100000
    hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${hash_bytes.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain text password against PBKDF2 hash or plain string fallback.
    """
    if not hashed_password:
        return False

    if hashed_password.startswith("pbkdf2_sha256$"):
        try:
            parts = hashed_password.split("$")
            if len(parts) != 4:
                return False
            iterations = int(parts[1])
            salt = bytes.fromhex(parts[2])
            target_hash = parts[3]
            computed_hash = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt, iterations).hex()
            return hmac.compare_digest(target_hash, computed_hash)
        except Exception:
            return False

    # Fallback comparison for unhashed legacy/test entries
    return hmac.compare_digest(plain_password, hashed_password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Generates HS256 signed JWT Access Token according to RFC 7519 standard.
    """
    to_encode = data.copy()
    now_utc = datetime.now(timezone.utc)
    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": int(expire.timestamp())})

    # Header
    header = {"alg": ALGORITHM, "typ": "JWT"}
    header_b64 = base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))

    # Payload
    payload_b64 = base64url_encode(json.dumps(to_encode, separators=(',', ':')).encode('utf-8'))

    # Signature
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Validates HS256 JWT signature and checks token expiration time.
    Returns payload dictionary if valid, or None if tampered/expired.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, signature_b64 = parts

        # Verify HMAC-SHA256 signature
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        actual_sig = base64url_decode(signature_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            print("[Security] JWT signature validation failed.")
            return None

        # Decode payload JSON
        payload_bytes = base64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))

        # Expiration validation
        exp = payload.get("exp")
        if exp is not None and time.time() > float(exp):
            print("[Security] JWT token has expired.")
            return None

        return payload
    except Exception as e:
        print(f"[Security] Failed to decode JWT token: {e}")
        return None
