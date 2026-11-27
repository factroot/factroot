import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import sqlite3
import time
from email.message import EmailMessage
from pathlib import Path

from fastapi import APIRouter, Cookie, HTTPException, Response, status
from pydantic import BaseModel


DATABASE_PATH = Path(__file__).with_name("factroot.db")
SESSION_COOKIE = "factroot_session"
SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60
DEFAULT_SOURCES = [
    ("MOISaudiArabia", "وزارة الداخلية"),
    ("DgaGovSa", "هيئة الحكومة الرقمية"),
    ("ncgr_gov_sa", "المركز الوطني لنظم الموارد الحكومية"),
    ("CGCSaudi", "مركز التواصل الحكومي"),
]

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyResetCodeRequest(BaseModel):
    email: str
    code: str


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str


class AccountStatusRequest(BaseModel):
    is_active: bool


class TrustedSourceRequest(BaseModel):
    account: str
    label: str


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database():
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user'
                    CHECK (role IN ('user', 'admin')),
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_token_hash
            ON sessions(token_hash);

            CREATE TABLE IF NOT EXISTS password_resets (
                email TEXT PRIMARY KEY COLLATE NOCASE,
                otp_salt TEXT NOT NULL,
                otp_hash TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                sent_at INTEGER NOT NULL,
                reset_token_hash TEXT,
                reset_expires_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS verification_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                guest_hash TEXT,
                news_text TEXT NOT NULL,
                result_status TEXT NOT NULL,
                best_match_json TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CHECK (user_id IS NOT NULL OR guest_hash IS NOT NULL)
            );

            CREATE INDEX IF NOT EXISTS idx_history_user_id
            ON verification_history(user_id, created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_history_guest_hash
            ON verification_history(guest_hash);

            CREATE TABLE IF NOT EXISTS trusted_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account TEXT NOT NULL UNIQUE COLLATE NOCASE,
                label TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL
            );
            """
        )

        source_count = connection.execute(
            "SELECT COUNT(*) FROM trusted_sources"
        ).fetchone()[0]
        if source_count == 0:
            connection.executemany(
                """
                INSERT INTO trusted_sources (account, label, is_active, created_at)
                VALUES (?, ?, 1, ?)
                """,
                [(account, label, int(time.time())) for account, label in DEFAULT_SOURCES],
            )


def normalize_email(email: str):
    return email.strip().lower()


def validate_registration(data: RegisterRequest):
    name = data.name.strip()
    email = normalize_email(data.email)

    if len(name) < 2 or len(name) > 80:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="يجب أن يكون الاسم بين حرفين و80 حرفًا.",
        )

    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="البريد الإلكتروني غير صحيح.",
        )

    if len(data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.",
        )

    return name, email


def hash_password(password: str):
    salt = secrets.token_bytes(16)
    iterations = 600_000
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str):
    try:
        algorithm, iterations_text, salt_hex, digest_hex = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False

        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations_text),
        )
        return hmac.compare_digest(candidate, bytes.fromhex(digest_hex))
    except (ValueError, TypeError):
        return False


def _send_password_reset_email(email: str, code: str):
    """Send a one-time password reset code through the configured Gmail SMTP account."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "465"))
    smtp_email = os.getenv("SMTP_EMAIL", "").strip()
    smtp_password = os.getenv("SMTP_APP_PASSWORD", "").replace(" ", "")
    from_name = os.getenv("SMTP_FROM_NAME", "FactRoot").strip() or "FactRoot"

    if not smtp_email or not smtp_password:
        raise RuntimeError("Gmail SMTP settings are missing")

    message = EmailMessage()
    message["Subject"] = "FactRoot - Password reset code | رمز استعادة كلمة المرور"
    message["From"] = f"{from_name} <{smtp_email}>"
    message["To"] = email
    message.set_content(
        "مرحبًا،\n\n"
        f"رمز استعادة كلمة المرور لحساب FactRoot هو: {code}\n"
        "تنتهي صلاحية الرمز خلال 5 دقائق، ويمكن استخدامه مرة واحدة فقط.\n"
        "إذا لم تطلب استعادة كلمة المرور، فتجاهل هذه الرسالة.\n\n"
        "Hello,\n\n"
        f"Your FactRoot password reset code is: {code}\n"
        "This code expires in 5 minutes and can only be used once.\n"
        "If you did not request a password reset, you can ignore this email.\n"
    )

    if smtp_port == 465:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
            server.login(smtp_email, smtp_password)
            server.send_message(message)
    else:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_email, smtp_password)
            server.send_message(message)


def _hash_reset_code(email: str, code: str, salt_hex: str):
    # A slow hash limits offline guessing if the local SQLite database is exposed.
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        f"{normalize_email(email)}:{code}".encode("utf-8"),
        bytes.fromhex(salt_hex),
        200_000,
    )
    return digest.hex()


def public_user(row: sqlite3.Row):
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
    }


def create_session(response: Response, connection: sqlite3.Connection, user_id: int):
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    now = int(time.time())

    connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
    connection.execute(
        """
        INSERT INTO sessions (user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, token_hash, now + SESSION_LIFETIME_SECONDS, now),
    )

    response.set_cookie(
        key=SESSION_COOKIE,
        value=raw_token,
        max_age=SESSION_LIFETIME_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )


def find_user_by_session(raw_token: str | None):
    if not raw_token:
        return None

    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    now = int(time.time())

    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT users.id, users.name, users.email, users.role
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ?
              AND sessions.expires_at > ?
              AND users.is_active = 1
            """,
            (token_hash, now),
        ).fetchone()

    return row


def require_admin(raw_token: str | None):
    user = find_user_by_session(raw_token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="يجب تسجيل الدخول.",
        )
    if user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ليس لديك صلاحية الدخول إلى لوحة الإدارة.",
        )
    return user


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, response: Response):
    name, email = validate_registration(data)
    password_hash = hash_password(data.password)
    now = int(time.time())

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (name, email, password_hash, role, created_at)
                VALUES (?, ?, ?, 'user', ?)
                """,
                (name, email, password_hash, now),
            )
            user_id = cursor.lastrowid
            create_session(response, connection, user_id)
            row = connection.execute(
                "SELECT id, name, email, role FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="يوجد حساب مسجل بهذا البريد الإلكتروني.",
        )

    return {"message": "تم إنشاء الحساب بنجاح.", "user": public_user(row)}


@router.post("/login")
def login(data: LoginRequest, response: Response):
    email = normalize_email(data.email)

    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, name, email, password_hash, role, is_active
            FROM users
            WHERE email = ?
            """,
            (email,),
        ).fetchone()

        if not row or not verify_password(data.password, row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="البريد الإلكتروني أو كلمة المرور غير صحيحة.",
            )

        if not row["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="هذا الحساب موقوف.",
            )

        create_session(response, connection, row["id"])

    return {"message": "تم تسجيل الدخول بنجاح.", "user": public_user(row)}


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    email = normalize_email(data.email)
    generic_message = "إذا كان البريد مسجلًا ونشطًا، فسيتم إرسال رمز الاستعادة إليه."

    if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="أدخلي بريدًا إلكترونيًا صحيحًا.",
        )

    now = int(time.time())
    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, is_active FROM users WHERE email = ?", (email,)
        ).fetchone()
        previous_reset = connection.execute(
            "SELECT sent_at FROM password_resets WHERE email = ?", (email,)
        ).fetchone()

    # Keep the same response for unknown, inactive, and rate-limited email addresses.
    # This avoids revealing which email addresses have FactRoot accounts.
    if not user or not user["is_active"]:
        return {"message": generic_message}
    if previous_reset and now - previous_reset["sent_at"] < 60:
        return {"message": generic_message}

    code = f"{secrets.randbelow(1_000_000):06d}"
    salt_hex = secrets.token_hex(16)
    code_hash = _hash_reset_code(email, code, salt_hex)

    # Store the hashed code before sending. If SMTP fails, remove this exact request.
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO password_resets (
                email, otp_salt, otp_hash, expires_at, attempts, sent_at,
                reset_token_hash, reset_expires_at
            )
            VALUES (?, ?, ?, ?, 0, ?, NULL, NULL)
            ON CONFLICT(email) DO UPDATE SET
                otp_salt = excluded.otp_salt,
                otp_hash = excluded.otp_hash,
                expires_at = excluded.expires_at,
                attempts = 0,
                sent_at = excluded.sent_at,
                reset_token_hash = NULL,
                reset_expires_at = NULL
            """,
            (email, salt_hex, code_hash, now + 300, now),
        )

    try:
        _send_password_reset_email(email, code)
    except Exception:
        with get_connection() as connection:
            connection.execute(
                "DELETE FROM password_resets WHERE email = ? AND otp_hash = ?",
                (email, code_hash),
            )
        # Do not expose SMTP credentials, server responses, or internal exceptions.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="تعذر إرسال البريد الإلكتروني. تحققي من إعداد Gmail وحاولي مرة أخرى.",
        )

    return {"message": generic_message}


@router.post("/verify-reset-code")
def verify_reset_code(data: VerifyResetCodeRequest):
    email = normalize_email(data.email)
    code = data.code.strip()
    if not re.fullmatch(r"\d{6}", code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="أدخلي رمزًا مكوّنًا من 6 أرقام.",
        )

    now = int(time.time())
    with get_connection() as connection:
        reset = connection.execute(
            "SELECT * FROM password_resets WHERE email = ?", (email,)
        ).fetchone()
        if (
            not reset
            or reset["expires_at"] <= now
            or reset["attempts"] >= 5
            or reset["reset_token_hash"] is not None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="الرمز غير صالح أو انتهت صلاحيته. اطلبي رمزًا جديدًا.",
            )

        candidate_hash = _hash_reset_code(email, code, reset["otp_salt"])
        if not hmac.compare_digest(candidate_hash, reset["otp_hash"]):
            connection.execute(
                "UPDATE password_resets SET attempts = attempts + 1 WHERE email = ?",
                (email,),
            )
            connection.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="رمز التحقق غير صحيح.",
            )

        reset_token = secrets.token_urlsafe(32)
        reset_token_hash = hashlib.sha256(reset_token.encode("utf-8")).hexdigest()
        connection.execute(
            """
            UPDATE password_resets
            SET expires_at = 0, reset_token_hash = ?, reset_expires_at = ?
            WHERE email = ?
            """,
            (reset_token_hash, now + 600, email),
        )

    return {"reset_token": reset_token, "message": "تم التحقق من الرمز."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest):
    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.",
        )
    if len(data.new_password) > 128:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="كلمة المرور طويلة جدًا.",
        )
    if not data.reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="انتهت جلسة الاستعادة. ابدئي من جديد.",
        )

    token_hash = hashlib.sha256(data.reset_token.encode("utf-8")).hexdigest()
    now = int(time.time())
    with get_connection() as connection:
        reset = connection.execute(
            """
            SELECT email FROM password_resets
            WHERE reset_token_hash = ? AND reset_expires_at > ?
            """,
            (token_hash, now),
        ).fetchone()
        if not reset:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="انتهت جلسة الاستعادة. ابدئي من جديد.",
            )

        email = reset["email"]
        user = connection.execute(
            "SELECT id, is_active FROM users WHERE email = ?", (email,)
        ).fetchone()
        if not user or not user["is_active"]:
            connection.execute("DELETE FROM password_resets WHERE email = ?", (email,))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="تعذر استعادة هذا الحساب.",
            )

        connection.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(data.new_password), user["id"]),
        )
        # Require a fresh login on every device after a password reset.
        connection.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
        connection.execute("DELETE FROM password_resets WHERE email = ?", (email,))

    return {"message": "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن."}


@router.post("/logout")
def logout(response: Response, factroot_session: str | None = Cookie(default=None)):
    if factroot_session:
        token_hash = hashlib.sha256(factroot_session.encode("utf-8")).hexdigest()
        with get_connection() as connection:
            connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))

    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"message": "تم تسجيل الخروج بنجاح."}


@router.get("/me")
def current_user(factroot_session: str | None = Cookie(default=None)):
    row = find_user_by_session(factroot_session)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="لم يتم تسجيل الدخول.",
        )

    return {"user": public_user(row)}


@router.get("/guest-usage")
def guest_usage(factroot_guest: str | None = Cookie(default=None)):
    used = 0
    if factroot_guest:
        guest_hash = hashlib.sha256(factroot_guest.encode("utf-8")).hexdigest()
        with get_connection() as connection:
            used = connection.execute(
                "SELECT COUNT(*) FROM verification_history WHERE guest_hash = ?",
                (guest_hash,),
            ).fetchone()[0]

    return {"used": used, "limit": 3, "remaining": max(0, 3 - used)}


@router.get("/history")
def user_history(factroot_session: str | None = Cookie(default=None)):
    user = find_user_by_session(factroot_session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="يجب تسجيل الدخول لعرض السجل.",
        )

    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, news_text, result_status, best_match_json, created_at
            FROM verification_history
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 100
            """,
            (user["id"],),
        ).fetchall()

    history = []
    for row in rows:
        history.append(
            {
                "id": row["id"],
                "news": row["news_text"],
                "status": row["result_status"],
                "best_match": json.loads(row["best_match_json"]) if row["best_match_json"] else None,
                "created_at": row["created_at"],
            }
        )

    return {"history": history}


@router.get("/admin/stats")
def admin_stats(factroot_session: str | None = Cookie(default=None)):
    require_admin(factroot_session)
    with get_connection() as connection:
        users_count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        active_users = connection.execute(
            "SELECT COUNT(*) FROM users WHERE is_active = 1"
        ).fetchone()[0]
        checks_count = connection.execute(
            "SELECT COUNT(*) FROM verification_history"
        ).fetchone()[0]
        registered_checks = connection.execute(
            "SELECT COUNT(*) FROM verification_history WHERE user_id IS NOT NULL"
        ).fetchone()[0]

    return {
        "users": users_count,
        "active_users": active_users,
        "suspended_users": users_count - active_users,
        "checks": checks_count,
        "registered_checks": registered_checks,
        "guest_checks": checks_count - registered_checks,
    }


@router.get("/admin/users")
def admin_users(factroot_session: str | None = Cookie(default=None)):
    require_admin(factroot_session)
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, name, email, role, is_active, created_at
            FROM users
            ORDER BY created_at DESC
            """
        ).fetchall()

    return {
        "users": [
            {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"],
                "role": row["role"],
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    }


@router.patch("/admin/users/{user_id}/status")
def update_user_status(
    user_id: int,
    data: AccountStatusRequest,
    factroot_session: str | None = Cookie(default=None),
):
    admin = require_admin(factroot_session)
    if user_id == admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="لا يمكنك إيقاف حسابك الإداري الحالي.",
        )

    with get_connection() as connection:
        target = connection.execute(
            "SELECT id, role FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الحساب غير موجود.")
        if target["role"] == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="لا يمكن تعديل حساب مدير من لوحة المستخدمين.",
            )

        connection.execute(
            "UPDATE users SET is_active = ? WHERE id = ?",
            (1 if data.is_active else 0, user_id),
        )
        if not data.is_active:
            connection.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))

    return {"message": "تم تحديث حالة الحساب.", "is_active": data.is_active}


@router.get("/admin/sources")
def admin_sources(factroot_session: str | None = Cookie(default=None)):
    require_admin(factroot_session)
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, account, label, is_active, created_at
            FROM trusted_sources
            ORDER BY created_at ASC
            """
        ).fetchall()
    return {
        "sources": [
            {
                "id": row["id"],
                "account": row["account"],
                "label": row["label"],
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    }


@router.post("/admin/sources", status_code=status.HTTP_201_CREATED)
def add_admin_source(
    data: TrustedSourceRequest,
    factroot_session: str | None = Cookie(default=None),
):
    require_admin(factroot_session)
    account = data.account.strip().lstrip("@")
    label = data.label.strip()
    if not re.fullmatch(r"[A-Za-z0-9_]{1,15}", account):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="اسم حساب X غير صحيح.",
        )
    if len(label) < 2 or len(label) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="اسم الجهة يجب أن يكون بين حرفين و100 حرف.",
        )

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO trusted_sources (account, label, is_active, created_at)
                VALUES (?, ?, 1, ?)
                """,
                (account, label, int(time.time())),
            )
            source_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="هذا المصدر موجود بالفعل.",
        )

    return {
        "source": {
            "id": source_id,
            "account": account,
            "label": label,
            "is_active": True,
            "created_at": int(time.time()),
        }
    }


@router.patch("/admin/sources/{source_id}/status")
def update_source_status(
    source_id: int,
    data: AccountStatusRequest,
    factroot_session: str | None = Cookie(default=None),
):
    require_admin(factroot_session)
    with get_connection() as connection:
        source = connection.execute(
            "SELECT id FROM trusted_sources WHERE id = ?",
            (source_id,),
        ).fetchone()
        if not source:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="المصدر غير موجود.")
        connection.execute(
            "UPDATE trusted_sources SET is_active = ? WHERE id = ?",
            (1 if data.is_active else 0, source_id),
        )
    return {"message": "تم تحديث المصدر.", "is_active": data.is_active}


@router.get("/admin/activity")
def admin_activity(factroot_session: str | None = Cookie(default=None)):
    require_admin(factroot_session)
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT verification_history.id,
                   verification_history.result_status,
                   verification_history.best_match_json,
                   verification_history.created_at,
                   verification_history.user_id,
                   users.name AS user_name
            FROM verification_history
            LEFT JOIN users ON users.id = verification_history.user_id
            ORDER BY verification_history.created_at DESC
            LIMIT 25
            """
        ).fetchall()

    activity = []
    for row in rows:
        best_match = json.loads(row["best_match_json"]) if row["best_match_json"] else None
        activity.append(
            {
                "id": row["id"],
                "actor_type": "user" if row["user_id"] else "guest",
                "actor_name": row["user_name"] if row["user_id"] else None,
                "status": row["result_status"],
                "match_score": best_match.get("match_score") if best_match else None,
                "created_at": row["created_at"],
            }
        )
    return {"activity": activity}


initialize_database()
