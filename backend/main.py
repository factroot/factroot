import hashlib
import json
import os
import re
import secrets
import time
import requests

from dotenv import load_dotenv
from fastapi import Cookie, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from backend.auth import find_user_by_session, get_connection, router as auth_router
from backend.ai_verifier import analyze_claim_with_ai


# =========================
# إعداد ملف X
# =========================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(BASE_DIR, ".env.local")

load_dotenv(ENV_FILE, override=True)

X_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN")
GOOGLE_SAFE_BROWSING_API_KEY = os.getenv("GOOGLE_SAFE_BROWSING_API_KEY")

print(
    "X TOKEN:",
    "FOUND" if X_BEARER_TOKEN else "NOT FOUND"
)


# =========================
# الحسابات الحكومية الموثوقة
# =========================

def get_trusted_accounts():
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT account
            FROM trusted_sources
            WHERE is_active = 1
            ORDER BY created_at ASC
            """
        ).fetchall()
    return [row["account"] for row in rows]


# =========================
# FastAPI
# =========================

app = FastAPI(
    title="FactRoot API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


# =========================
# نموذج الخبر
# =========================

class News(BaseModel):
    text: str


# =========================
# الصفحة الرئيسية
# =========================

@app.get("/")
def home():
    return {
        "message": "FactRoot Backend يعمل"
    }


# =========================
# فحص أمان الروابط باستخدام Google Safe Browsing
# =========================

class URLCheck(BaseModel):
    url: str


def _build_safe_browsing_request(raw_url):
    api_url = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
    body = {
        "client": {"clientId": "FactRoot", "clientVersion": "1.0"},
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": raw_url}]
        }
    }
    return api_url, body


def _build_url_safety_result(matches):
    if matches:
        safety = {
            "verdict": "unsafe", "score": 0,
            "message": "تحذير: صنّفت خدمة Google Safe Browsing الرابط على أنه خطر أو مضلل. تجنب فتحه."
        }
        status_text = "تم اكتشاف تهديد محتمل في الرابط"
    else:
        safety = {
            "verdict": "no_known_threat", "score": 90,
            "message": "لم تعثر Google Safe Browsing على تهديد معروف. هذا لا يضمن أن الرابط آمن 100%."
        }
        status_text = "لم يتم العثور على تهديد معروف للرابط"
    return safety, status_text


def _reject_private_addresses(addresses, ipaddress):
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise HTTPException(status_code=400, detail="الرابط يشير إلى عنوان داخلي أو غير عام.")


def _build_url_check_payload(raw_url, status_text, safety):
    return {
        "status": status_text,
        "news": raw_url,
        "keywords": [],
        "accounts_checked": [],
        "best_match": None,
        "results": [],
        "url_safety": safety,
    }


def _insert_url_verification_history(connection, current_user, guest_hash, raw_url, status_text):
    connection.execute(
        """
            INSERT INTO verification_history (
                user_id, guest_hash, news_text, result_status,
                best_match_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
        (
            current_user["id"] if current_user else None,
            guest_hash,
            raw_url,
            status_text,
            None,
            int(time.time()),
        ),
    )


def _add_url_guest_usage(connection, guest_hash, payload):
    used_attempts = connection.execute(
        "SELECT COUNT(*) FROM verification_history WHERE guest_hash = ?",
        (guest_hash,),
    ).fetchone()[0]

    payload["guest_usage"] = {
        "used": used_attempts,
        "limit": 3,
        "remaining": max(0, 3 - used_attempts),
    }


def _prepare_url_guest_check(response, factroot_guest):
    guest_token = factroot_guest or secrets.token_urlsafe(32)
    guest_hash = hashlib.sha256(guest_token.encode("utf-8")).hexdigest()

    with get_connection() as connection:
        guest_attempts = connection.execute(
            "SELECT COUNT(*) FROM verification_history WHERE guest_hash = ?",
            (guest_hash,),
        ).fetchone()[0]

    if guest_attempts >= 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "guest_limit_reached",
                "message": "استخدمت محاولات الزائر الثلاث. سجّل الدخول للمتابعة.",
            },
        )

    if not factroot_guest:
        response.set_cookie(
            key="factroot_guest",
            value=guest_token,
            max_age=365 * 24 * 60 * 60,
            httponly=True,
            samesite="lax",
            secure=False,
            path="/",
        )
    return guest_hash


def _validate_url_hostname(parsed):
    hostname = parsed.hostname.lower()
    if hostname in ("localhost",) or hostname.endswith(".local"):
        raise HTTPException(status_code=400, detail="لا يمكن فحص الروابط المحلية.")
    return hostname


def _check_url_dns(hostname, raw_url, socket, ipaddress):
    try:
        addresses = socket.getaddrinfo(hostname, None)
        _reject_private_addresses(addresses, ipaddress)
    except socket.gaierror:
        return {
            "status": "تعذر التحقق من الرابط",
            "news": raw_url, "keywords": [], "accounts_checked": [],
            "best_match": None, "results": [],
            "url_safety": {"verdict": "unknown", "score": 50,
                           "message": "تعذر العثور على نطاق الرابط. لا تفتحه قبل التأكد منه."}
        }
    return None


def _require_google_safe_browsing_api_key():
    if not GOOGLE_SAFE_BROWSING_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="فحص الروابط يحتاج GOOGLE_SAFE_BROWSING_API_KEY في ملف backend/.env.local."
        )


def _request_safe_browsing_data(api_url, body):
    try:
        response = requests.post(
            api_url, params={"key": GOOGLE_SAFE_BROWSING_API_KEY},
            json=body, timeout=15
        )
        if not response.ok:
            # Google returns a structured error for invalid/disabled API keys.
            if response.status_code in (400, 403):
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "رفضت Google طلب فحص الرابط. تأكدي من صحة GOOGLE_SAFE_BROWSING_API_KEY "
                        "وتفعيل Safe Browsing API في Google Cloud."
                    )
                )

            raise HTTPException(
                status_code=502,
                detail="تعذر الاتصال بخدمة فحص الروابط. حاول لاحقًا."
            )
        data = response.json()
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="انتهت مهلة الاتصال بخدمة فحص الروابط. حاول لاحقًا.")
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="تعذر الاتصال بخدمة فحص الروابط. حاول لاحقًا.")
    return data


def _get_safe_browsing_matches(data):
    return data.get("matches", [])


def _persist_url_check_result(current_user, guest_hash, raw_url, status_text, payload):
    with get_connection() as connection:
        _insert_url_verification_history(
            connection, current_user, guest_hash, raw_url, status_text
        )

        if not current_user:
            _add_url_guest_usage(connection, guest_hash, payload)


@app.post("/check-url")
def check_url_safety(
    request: URLCheck,
    response: Response,
    factroot_session: str | None = Cookie(default=None),
    factroot_guest: str | None = Cookie(default=None),
):
    from urllib.parse import urlparse
    import ipaddress
    import socket

    raw_url = request.url.strip()
    parsed = urlparse(raw_url)

    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="أدخل رابطًا صحيحًا يبدأ بـ http أو https.")
    current_user = find_user_by_session(factroot_session)
    guest_hash = None

    if not current_user:
        guest_hash = _prepare_url_guest_check(response, factroot_guest)

    # منع الروابط المحلية والخاصة قبل إرسالها لخدمة الفحص
    hostname = _validate_url_hostname(parsed)

    dns_result = _check_url_dns(hostname, raw_url, socket, ipaddress)
    if dns_result is not None:
        return dns_result

    _require_google_safe_browsing_api_key()

    api_url, body = _build_safe_browsing_request(raw_url)
    data = _request_safe_browsing_data(api_url, body)

    matches = _get_safe_browsing_matches(data)
    safety, status_text = _build_url_safety_result(matches)

    payload = _build_url_check_payload(raw_url, status_text, safety)

    _persist_url_check_result(current_user, guest_hash, raw_url, status_text, payload)

    return payload



# =========================
# تنظيف وتوحيد النص العربي
# =========================

def _remove_urls_and_markers(text):
    # إزالة الروابط
    text = re.sub(
        r"https?://\S+",
        " ",
        text
    )

    # إزالة الهاشتاق والمنشن
    text = text.replace("#", " ")
    text = text.replace("@", " ")

    return text


def _normalize_arabic_characters(text):
    # إزالة التشكيل العربي
    arabic_diacritics = re.compile(
        r"[\u0617-\u061A\u064B-\u0652\u0670\u0640]"
    )

    text = re.sub(
        arabic_diacritics,
        "",
        text
    )

    # =========================
    # توحيد أشكال الألف والهمزة
    # =========================

    # أ / إ / آ / ٱ  تصبح ا
    text = re.sub(
        r"[أإآٱ]",
        "ا",
        text
    )

    # =========================
    # توحيد الألف المقصورة
    # =========================

    # ى تصبح ي
    text = text.replace(
        "ى",
        "ي"
    )

    # =========================
    # توحيد التاء المربوطة
    # =========================

    # ة تصبح ه
    text = text.replace(
        "ة",
        "ه"
    )

    # =========================
    # توحيد أشكال الياء
    # =========================

    # ى تم التعامل معها فوق
    # ويمكن أيضًا التعامل مع الياء الفارسية
    text = text.replace(
        "ی",
        "ي"
    )

    return text


def _remove_punctuation_and_normalize_spaces(text):
    # =========================
    # إزالة علامات الترقيم والرموز
    # =========================

    text = re.sub(
        r"[^\w\s]",
        " ",
        text
    )

    # =========================
    # توحيد المسافات
    # =========================

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text


def clean_text(text):
    text = _remove_urls_and_markers(text)
    text = _normalize_arabic_characters(text)
    text = _remove_punctuation_and_normalize_spaces(text)

    return text.strip().lower()


# =========================
# استخراج الكلمات المهمة
# =========================

def _filter_keywords(words, stop_words):
    keywords = []

    for word in words:

        # تجاهل الكلمات القصيرة جدًا
        if len(word) < 3:
            continue

        # تجاهل الكلمات العامة
        if word in stop_words:
            continue

        # عدم تكرار الكلمة
        if word not in keywords:
            keywords.append(word)

    return keywords


def extract_keywords(text):

    text = clean_text(text)

    words = text.split()

    # الكلمات الشائعة التي لا تساعد كثيرًا في البحث
    stop_words = {
        "من",
        "في",
        "على",
        "الى",
        "عن",
        "مع",
        "هذا",
        "هذه",
        "ذلك",
        "تلك",
        "هو",
        "هي",
        "تم",
        "قد",
        "ما",
        "لا",
        "لم",
        "لن",
        "ان",
        "إن",
        "و",
        "او",
        "ثم",
        "كما",
        "بعد",
        "قبل",
        "خلال",
        "اليوم",
        "امس",
        "غدا",
        "الذي",
        "التي",
        "الذين",
    }

    return _filter_keywords(words, stop_words)


# =========================
# البحث في X
# =========================

def search_x(query, max_results=10):

    url = "https://api.x.com/2/tweets/search/all"

    headers = {
        "Authorization": f"Bearer {X_BEARER_TOKEN}"
    }

    params = {
        "query": query,
        "max_results": max_results,
        "tweet.fields": "created_at,author_id,text",
    }

    response = requests.get(
        url,
        headers=headers,
        params=params,
        timeout=20
    )

    try:
        data = response.json()

    except ValueError:
        data = {
            "error": response.text
        }

    return response.status_code, data


# =========================
# حساب تطابق الخبر والمنشور
# =========================

def calculate_match(news_text, post_text):

    news_keywords = set(
        extract_keywords(news_text)
    )

    post_keywords = set(
        extract_keywords(post_text)
    )

    if not news_keywords:
        return 0

    common_words = news_keywords.intersection(
        post_keywords
    )

    score = (
        len(common_words)
        / len(news_keywords)
    ) * 100

    return round(score, 1)


# =========================
# التحقق من الخبر
# =========================

def _collect_posts(results):
    all_posts = []

    for result in results:

        for post in result.get(
            "posts",
            []
        ):

            all_posts.append({
                "account": result["account"],
                **post
            })


    return all_posts


def _analyze_posts(news, posts):
    analyzed_posts = []

    for post in posts:

        post_text = post.get(
            "text",
            ""
        )

        score = calculate_match(
            news.text,
            post_text
        )

        analyzed_posts.append({
            "id": post.get("id"),
            "created_at": post.get(
                "created_at"
            ),
            "text": post_text,
            "match_score": score,
        })

    # الأعلى تطابقًا أولًا
    analyzed_posts.sort(
        key=lambda x: x["match_score"],
        reverse=True
    )

    return analyzed_posts


@app.post("/check")
def check_news(
    news: News,
    response: Response,
    factroot_session: str | None = Cookie(default=None),
    factroot_guest: str | None = Cookie(default=None),
):

    # التأكد من وجود التوكن
    if not X_BEARER_TOKEN:
        return {
            "status": "خطأ",
            "message": "X_BEARER_TOKEN غير موجود في .env.local"
        }

    # التأكد من وجود خبر
    if not news.text.strip():
        return {
            "status": "خطأ",
            "message": "لم يتم إدخال خبر"
        }

    # استخراج الكلمات المهمة
    keywords = extract_keywords(news.text)

    if not keywords:
        return {
            "status": "خطأ",
            "message": "لم نتمكن من استخراج كلمات واضحة من الخبر"
        }

    current_user = find_user_by_session(factroot_session)
    guest_hash = None

    if not current_user:
        guest_token = factroot_guest or secrets.token_urlsafe(32)
        guest_hash = hashlib.sha256(guest_token.encode("utf-8")).hexdigest()

        with get_connection() as connection:
            guest_attempts = connection.execute(
                "SELECT COUNT(*) FROM verification_history WHERE guest_hash = ?",
                (guest_hash,),
            ).fetchone()[0]

        if guest_attempts >= 3:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "guest_limit_reached",
                    "message": "استخدمت محاولات الزائر الثلاث. سجّل الدخول للمتابعة.",
                },
            )

        if not factroot_guest:
            response.set_cookie(
                key="factroot_guest",
                value=guest_token,
                max_age=365 * 24 * 60 * 60,
                httponly=True,
                samesite="lax",
                secure=False,
                path="/",
            )

    results = []
    trusted_accounts = get_trusted_accounts()

    if not trusted_accounts:
        return {
            "status": "خطأ",
            "message": "لا توجد مصادر موثوقة نشطة حاليًا.",
        }

       # نستخدم الكلمات الأصلية عند البحث في X دون تغيير الحروف العربية
    search_words = [
        word.strip(".,،!؟:;؛#@()[]{}\"'")
        for word in news.text.split()
        if len(word.strip(".,،!؟:;؛#@()[]{}\"'")) >= 3
    ][:8]

    # =========================
    # البحث داخل الحسابات الحكومية
    # =========================

    for account in trusted_accounts:

        keyword_query = " OR ".join(
            f'"{word}"'
            for word in search_words
        )

        query = (
            f"from:{account} "
            f"({keyword_query}) "
            f"-is:retweet"
        )

        try:

            status_code, data = search_x(
                query,
                max_results=20
            )

            # =========================
            # نجاح البحث
            # =========================

            if status_code == 200:

                posts = data.get(
                    "data",
                    []
                )

                analyzed_posts = _analyze_posts(news, posts)

               # نرسل أفضل المنشورات إلى AI حتى لو اختلفت الكلمات
                relevant_posts = analyzed_posts[:5]

                results.append({
                    "account": f"@{account}",
                    "found": len(relevant_posts) > 0,
                    "posts": relevant_posts,
                })

            # =========================
            # رصيد X غير كافٍ
            # =========================

            elif status_code == 402:

                results.append({
                    "account": f"@{account}",
                    "found": False,
                    "posts": [],
                    "error": "رصيد X API غير كافٍ",
                })

            # =========================
            # تجاوز عدد الطلبات
            # =========================

            elif status_code == 429:

                results.append({
                    "account": f"@{account}",
                    "found": False,
                    "posts": [],
                    "error": "تم الوصول إلى حد الطلبات مؤقتًا",
                })

            # =========================
            # خطأ آخر
            # =========================

            else:

                results.append({
                    "account": f"@{account}",
                    "found": False,
                    "posts": [],
                    "error": data,
                })

        except requests.RequestException as e:

            results.append({
                "account": f"@{account}",
                "found": False,
                "posts": [],
                "error": str(e),
            })


    # =========================
    # جمع جميع المنشورات
    # =========================

    all_posts = _collect_posts(results)

    # ترتيب المنشورات حسب التطابق
    all_posts.sort(
        key=lambda x: x.get(
            "match_score",
            0
        ),
        reverse=True
    )


       # AI هو المسؤول عن القرار النهائي
    ai_analysis = analyze_claim_with_ai(
        news.text,
        all_posts,
    )

    best_match = None

    if ai_analysis.get("available"):
        verdict = ai_analysis.get("verdict")
        selected_post_id = ai_analysis.get("selected_post_id")

        if selected_post_id:
            best_match = next(
                (
                    post
                    for post in all_posts
                    if str(post.get("id")) == str(selected_post_id)
                ),
                None,
            )

        if best_match:
            best_match = {
                **best_match,
                "ai_confidence": ai_analysis.get("confidence", 0),
            }

        if verdict == "supported":
            overall_status = "الخبر مدعوم من مصدر رسمي"
        elif verdict == "contradicted":
            overall_status = "الخبر متعارض مع مصدر رسمي"
        else:
            overall_status = "لم نجد دليلًا رسميًا كافيًا"
    else:
        overall_status = (
            "تعذر تشغيل تحليل الذكاء الاصطناعي مؤقتًا. حاول مرة أخرى."
        )


    payload = {
        "status": overall_status,
        "news": news.text,
        "keywords": keywords,
        "accounts_checked": trusted_accounts,
        "best_match": best_match,
        "results": results,
        "ai_analysis": ai_analysis,
    }

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO verification_history (
                user_id, guest_hash, news_text, result_status,
                best_match_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                current_user["id"] if current_user else None,
                guest_hash,
                news.text,
                overall_status,
                json.dumps(best_match, ensure_ascii=False) if best_match else None,
                int(time.time()),
            ),
        )

        if not current_user:
            used_attempts = connection.execute(
                "SELECT COUNT(*) FROM verification_history WHERE guest_hash = ?",
                (guest_hash,),
            ).fetchone()[0]
            payload["guest_usage"] = {
                "used": used_attempts,
                "limit": 3,
                "remaining": max(0, 3 - used_attempts),
            }

    return payload
