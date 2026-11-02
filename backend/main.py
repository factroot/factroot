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


@app.post("/check-url")
def check_url_safety(request: URLCheck):
    from urllib.parse import urlparse
    import ipaddress
    import socket

    raw_url = request.url.strip()
    parsed = urlparse(raw_url)

    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="أدخل رابطًا صحيحًا يبدأ بـ http أو https.")

    # منع الروابط المحلية والخاصة قبل إرسالها لخدمة الفحص
    hostname = parsed.hostname.lower()
    if hostname in ("localhost",) or hostname.endswith(".local"):
        raise HTTPException(status_code=400, detail="لا يمكن فحص الروابط المحلية.")

    try:
        addresses = socket.getaddrinfo(hostname, None)
        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                raise HTTPException(status_code=400, detail="الرابط يشير إلى عنوان داخلي أو غير عام.")
    except socket.gaierror:
        return {
            "status": "تعذر التحقق من الرابط",
            "news": raw_url, "keywords": [], "accounts_checked": [],
            "best_match": None, "results": [],
            "url_safety": {"verdict": "unknown", "score": 50,
                           "message": "تعذر العثور على نطاق الرابط. لا تفتحه قبل التأكد منه."}
        }

    if not GOOGLE_SAFE_BROWSING_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="فحص الروابط يحتاج GOOGLE_SAFE_BROWSING_API_KEY في ملف backend/.env.local."
        )

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

    matches = data.get("matches", [])
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

    return {
        "status": status_text, "news": raw_url, "keywords": [],
        "accounts_checked": [], "best_match": None, "results": [],
        "url_safety": safety
    }



# =========================
# تنظيف وتوحيد النص العربي
# =========================

def clean_text(text):

    # إزالة الروابط
    text = re.sub(
        r"https?://\S+",
        " ",
        text
    )

    # إزالة الهاشتاق والمنشن
    text = text.replace("#", " ")
    text = text.replace("@", " ")

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

    return text.strip().lower()


# =========================
# استخراج الكلمات المهمة
# =========================

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

    # نستخدم أول 6 كلمات مهمة للبحث
    search_words = keywords[:6]

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

                # نعرض فقط التطابقات الجيدة
                relevant_posts = [
                    post
                    for post in analyzed_posts
                    if post["match_score"] >= 35
                ]

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


    # ترتيب المنشورات حسب التطابق
    all_posts.sort(
        key=lambda x: x.get(
            "match_score",
            0
        ),
        reverse=True
    )


    # أفضل تطابق
    best_match = (
        all_posts[0]
        if all_posts
        else None
    )


    # =========================
    # النتيجة النهائية
    # =========================

    if best_match:

        score = best_match["match_score"]

        if score >= 75:

            overall_status = (
                "يوجد منشور حكومي مطابق بدرجة قوية"
            )

        elif score >= 50:

            overall_status = (
                "يوجد منشور حكومي مرتبط بالخبر"
            )

        else:

            overall_status = (
                "لم نجد تطابقًا حكوميًا قويًا"
            )

    else:

        overall_status = (
            "لم نجد منشورًا حكوميًا مطابقًا حاليًا"
        )


    payload = {
        "status": overall_status,
        "news": news.text,
        "keywords": keywords,
        "accounts_checked": trusted_accounts,
        "best_match": best_match,
        "results": results,
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
