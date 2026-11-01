"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ImageNewsInput from "./components/ImageNewsInput";
import AuthModal, { AuthUser } from "./components/AuthModal";

type Post = {
  id: string;
  created_at?: string;
  text: string;
  match_score: number;
};

type ResultItem = {
  account: string;
  found: boolean;
  posts: Post[];
  error?: string | object;
};

type CheckResult = {
  status: string;
  news: string;
  keywords: string[];
  accounts_checked: string[];
  best_match: {
    account: string;
    id: string;
    created_at?: string;
    text: string;
    match_score: number;
  } | null;
  results: ResultItem[];
  guest_usage?: {
    used: number;
    limit: number;
    remaining: number;
  };
};

type GuestUsage = {
  used: number;
  limit: number;
  remaining: number;
};

type SpeechRecognitionResultEventLike = {
  results: ArrayLike<{ 0: { transcript: string } }>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState<"ar" | "en">("ar");

  useEffect(() => {
    let savedDarkMode = false;
    let savedLanguage: "ar" | "en" = "ar";

    try {
      savedDarkMode =
        localStorage.getItem("factroot-dark-mode") === "true";

      const storedLanguage =
        localStorage.getItem("factroot-language");

      if (storedLanguage === "ar" || storedLanguage === "en") {
        savedLanguage = storedLanguage;
      }
    } catch {}

    setDarkMode(savedDarkMode);
    setLanguage(savedLanguage);

    document.documentElement.classList.toggle(
      "factroot-dark",
      savedDarkMode
    );

    document.documentElement.lang = savedLanguage;
    document.documentElement.dir =
      savedLanguage === "ar" ? "rtl" : "ltr";
  }, []);

  function setTheme(mode: "dark" | "light") {
    const isDark = mode === "dark";

    setDarkMode(isDark);

    document.documentElement.classList.toggle(
      "factroot-dark",
      isDark
    );

    try {
      localStorage.setItem(
        "factroot-dark-mode",
        String(isDark)
      );
    } catch {}
  }

  function changeLanguage(newLanguage: "ar" | "en") {
    setLanguage(newLanguage);

    document.documentElement.lang = newLanguage;
    document.documentElement.dir =
      newLanguage === "ar" ? "rtl" : "ltr";

    try {
      localStorage.setItem(
        "factroot-language",
        newLanguage
      );
    } catch {}
  }
  const [news, setNews] = useState("");
  const [imageReading, setImageReading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTopButton, setShowTopButton] = useState(false);
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [guestUsage, setGuestUsage] = useState<GuestUsage | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  async function checkNews() {
    if (!news.trim()) {
      setError("فضلاً أدخل الخبر أولاً.");
      return;
    }
    const isUrl = /^https?:\/\/\S+$/i.test(news.trim());

const endpoint = isUrl
  ? "http://localhost:8000/check-url"
  : "http://localhost:8000/check";

const payload = isUrl
  ? { url: news.trim() }
  : { text: news };
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.detail?.code === "guest_limit_reached") {
          setError(data.detail.message);
          setAuthOpen(true);
          return;
        }
        setError("حدث خطأ أثناء التحقق من الخبر.");
        return;
      }

      if (data.status === "خطأ") {
        setError(data.message || "حدث خطأ أثناء التحقق.");
        return;
      }

      setResult(data);
      if (data.guest_usage) setGuestUsage(data.guest_usage);
    } catch (err) {
      setError(
        "تعذر الاتصال بالخادم. تأكدي من تشغيل Backend على المنفذ 8000."
      );
    } finally {
      setLoading(false);
    }
  }

  function startVoiceInput() {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setSpeechSupported(false);
      setVoiceStatus("ميزة تحويل الصوت إلى نص غير مدعومة في هذا المتصفح. جرّب Chrome أو Edge.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "ar-SA";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatus("الميكروفون يعمل الآن. ابدأ بالتحدث.");
      setError("");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" " )
        .trim();

      if (transcript) {
        setNews((current) =>
          current.trim() ? `${current.trim()} ${transcript}` : transcript
        );
        setVoiceStatus("");
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceStatus("لم يتم السماح باستخدام الميكروفون. اسمح للموقع بالوصول إلى الميكروفون ثم حاول مرة أخرى.");
      } else if (event.error === "no-speech") {
        setVoiceStatus("لم أسمع كلامًا واضحًا. حاول مرة أخرى وتحدث بالقرب من الميكروفون.");
      } else {
        setVoiceStatus("تعذر تحويل الصوت إلى نص. حاول مرة أخرى.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }

  function speakText(text: string) {
    if (!("speechSynthesis" in window)) {
      setVoiceStatus("ميزة قراءة النص غير مدعومة في هذا المتصفح.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.95;

    const arabicVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("ar"));

    if (arabicVoice) utterance.voice = arabicVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      setVoiceStatus("تعذر تشغيل القراءة الصوتية.");
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }

  function readResultAloud() {
    if (!result) return;

    const statusText = hasStrongMatch
      ? "تم العثور على مصدر حكومي مطابق للخبر."
      : "لم يتم العثور على تطابق حكومي قوي.";

    const bestMatchText = result.best_match
      ? `الحساب الرسمي ${result.best_match.account}. درجة التطابق ${result.best_match.match_score} بالمئة. نص المنشور: ${result.best_match.text}`
      : "لم يتم العثور على منشور حكومي مطابق لهذا الخبر حاليًا.";

    speakText(`${statusText} ${bestMatchText}`);
  }

  useEffect(() => {
    fetch("http://localhost:8000/auth/me", {
      credentials: "include",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => undefined);

    fetch("http://localhost:8000/auth/guest-usage", {
      credentials: "include",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setGuestUsage(data);
      })
      .catch(() => undefined);

    const handleScroll = () => {
      setShowTopButton(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  async function logout() {
    try {
      await fetch("http://localhost:8000/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setCurrentUser(null);
      setAccountMenuOpen(false);
    }
  }

  function scrollToSection(id: string) {
    const section = document.getElementById(id);

    if (section) {
      window.scrollTo({
        top: section.offsetTop - 60,
        behavior: "smooth",
      });
    }
  }

  const hasStrongMatch =
    result?.best_match &&
    result.best_match.match_score >= 75;

  const guestLimitReached = !currentUser && guestUsage?.remaining === 0;

  return (
    <main
  className="factroot-home"
  dir={language === "ar" ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: `
          radial-gradient(
            circle at 15% 20%,
            rgba(37,99,235,.08), 
            transparent 350px
          ),
          radial-gradient(
            circle at 85% 70%,
            rgba(96,165,250,.08),
            transparent 350px
          ),
          linear-gradient(
            180deg,
            #f8fbff 0%,
            #eef4fb 100%
          )
        `,
        padding: "50px 20px",
        fontFamily: "Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
 {/* دائرة كبيرة يسار */}
<div
  style={{
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: "50%",
    background: "rgba(59,130,246,.10)",
    top: -80,
    left: -220,
    filter: "blur(25px)",
    zIndex: 0,
  }}
/>

{/* دائرة كبيرة يمين */}
<div
  style={{
    position: "absolute",
    width: 450,
    height: 450,
    borderRadius: "50%",
    background: "rgba(96,165,250,.08)",
    bottom: -120,
    right: -180,
    filter: "blur(25px)",
    zIndex: 0,
  }}
/>

{/* شعار بالخلفية */}
<img
  src="/logo.png"
  alt=""
  style={{
    position: "absolute",
    left: 60,
    top: 180,
    width: 320,
    opacity: 0.035,
    filter: "grayscale(100%)",
    pointerEvents: "none",
    zIndex: 0,
  }}
/>

{/* نقاط زخرفية */}
<div
  style={{
    position: "absolute",
    left: 60,
    top: 420,
    width: 120,
    height: 120,
    backgroundImage:
      "radial-gradient(#60A5FA 2px, transparent 2px)",
    backgroundSize: "18px 18px",
    opacity: .25,
    zIndex: 0,
  }}
/>

<div
  style={{
    position: "absolute",
    right: 70,
    top: 250,
    width: 120,
    height: 120,
    backgroundImage:
      "radial-gradient(#60A5FA 2px, transparent 2px)",
    backgroundSize: "18px 18px",
    opacity: .25,
    zIndex: 0,
  }}
/>

      {/* =========================
          الهيدر
      ========================= */}

      <header
        className="factroot-header"
        dir="ltr"
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "18px 40px",
          margin: "0 auto 35px",
          position: "relative",
          zIndex: 2,
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 30,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <img
            src="/logo.png"
            className="factroot-logo"
            width={130}
            height={130}
            alt="FactRoot logo"
          />

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 45,
                fontWeight: "bold",
                color: "#000",
              }}
            >
              Fact
              <span style={{ color: "#2563EB" }}>
                Root
              </span>
            </h1>

            <p
              style={{
                margin: 0,
                fontSize: 16,
                color: "#555",
              }}
            >
            {language === "ar"
  ? "تحقق من الأخبار من مصادر موثوقة"
  : "Verify news using trusted sources"}
            </p>
          </div>
        </div>

       <nav
  className="factroot-nav"
  dir={language === "ar" ? "rtl" : "ltr"}
  style={{
    alignItems: "center",
    flexWrap: "wrap",
    display: "flex",
    gap: 30,
    fontSize: 17,
    fontWeight: 600,
    paddingRight: 210,
  }}
>
  <div
  style={{
    position: "absolute",
    top: 18,
    right: 24,
    display: "flex",
    alignItems: "center",
    gap: 8,
    direction: "ltr",
    zIndex: 20,
    transform: "scale(0.88)",
    transformOrigin: "top right",
  }}
>
  {/* Dark / Light */}
  <div
    style={{
      width: 118,
      height: 50,
      padding: 4,
      display: "flex",
      alignItems: "center",
      borderRadius: 999,
      border: darkMode
        ? "1px solid #40577B"
        : "1px solid #CBD5E1",
      background: darkMode
        ? "#17263D"
        : "#F1F5F9",
      boxSizing: "border-box",
    }}
  >
    {/* Moon */}
    <button
      type="button"
      onClick={() => setTheme("dark")}
      aria-label="Dark mode"
      title="Dark mode"
      style={{
        width: 42,
        height: 42,
        border: "none",
        borderRadius: "50%",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        fontSize: 22,
        transition: "all .25s ease",

        background: darkMode
          ? "linear-gradient(135deg,#2563EB,#4F7CFF)"
          : "transparent",

        color: darkMode
          ? "#FFFFFF"
          : "#64748B",

        boxShadow: darkMode
          ? "0 4px 14px rgba(37,99,235,.45)"
          : "none",
      }}
    >
      ☾
    </button>

    {/* Sun */}
    <button
      type="button"
      onClick={() => setTheme("light")}
      aria-label="Light mode"
      title="Light mode"
      style={{
        width: 42,
        height: 42,
        border: "none",
        borderRadius: "50%",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        fontSize: 20,
        transition: "all .25s ease",

        background: !darkMode
          ? "#FFFFFF"
          : "transparent",

        color: !darkMode
          ? "#2563EB"
          : "#94A3B8",

        boxShadow: !darkMode
          ? "0 3px 10px rgba(15,23,42,.12)"
          : "none",
      }}
    >
      ☼
    </button>
  </div>

  {/* Divider */}
  <div
    style={{
      width: 1,
      height: 40,
      background: darkMode
        ? "#3B4E6A"
        : "#CBD5E1",
    }}
  />

  {/* AR / EN */}
  <div
    style={{
      height: 50,
      padding: 4,
      display: "flex",
      alignItems: "center",
      gap: 2,
      borderRadius: 999,
      border: darkMode
        ? "1px solid #40577B"
        : "1px solid #CBD5E1",
      background: darkMode
        ? "#17263D"
        : "#F1F5F9",
      boxSizing: "border-box",
    }}
  >
    <button
      type="button"
      onClick={() => changeLanguage("ar")}
      aria-label="العربية"
      style={{
        width: 42,
        height: 42,
        borderRadius: "50%",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 800,
        transition: "all .25s ease",

        border:
          language === "ar"
            ? "2px solid #477AFF"
            : "2px solid transparent",

        background:
          language === "ar"
            ? darkMode
              ? "#1C3154"
              : "#FFFFFF"
            : "transparent",

        color:
          language === "ar"
            ? "#4F7CFF"
            : darkMode
            ? "#94A3B8"
            : "#64748B",
      }}
    >
      AR
    </button>

    <button
      type="button"
     onClick={() => changeLanguage("en")}
      aria-label="English"
      style={{
        width: 42,
        height: 42,
        border: "none",
        borderRadius: "50%",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 700,
        transition: "all .25s ease",

        background:
          language === "en"
            ? "linear-gradient(135deg,#2563EB,#4F7CFF)"
            : "transparent",

        color:
          language === "en"
            ? "#FFFFFF"
            : darkMode
            ? "#CBD5E1"
            : "#64748B",
      }}
    >
      EN
    </button>
  </div>
</div>

          <span
            style={{ cursor: "pointer" }}
            onClick={() =>
              scrollToSection("how-it-works")
            }
          >
           {language === "ar" ? "كيف يعمل؟" : "How It Works?"}
          </span>

          <span
            style={{ cursor: "pointer" }}
            onClick={() =>
              scrollToSection("about")
            }
          >
           {language === "ar" ? "من نحن" : "About Us"}
          </span>
          {currentUser ? (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 10px 5px 13px",
                  border: "1px solid #38BDF8",
                  borderRadius: 999,
                  background: "#38BDF8",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(14,165,233,.2)",
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "#2563EB",
                    color: "#FFFFFF",
                    fontSize: 12,
                  }}
                >
                  {currentUser.name.trim().charAt(0).toUpperCase()}
                </span>
                <span>{currentUser.name}</span>
                <span style={{ color: "#FFFFFF", fontSize: 11 }}>⌄</span>
              </button>

              {accountMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    left: 0,
                    zIndex: 50,
                    width: 230,
                    padding: 10,
                    border: "1px solid #E2E8F0",
                    borderRadius: 14,
                    background: "#FFFFFF",
                    boxShadow: "0 14px 35px rgba(15,23,42,.16)",
                  }}
                >
                  <div style={{ padding: "8px 10px 12px", borderBottom: "1px solid #EEF2F7" }}>
                    <strong style={{ display: "block", color: "#172033", marginBottom: 4 }}>
                      {currentUser.name}
                    </strong>
                    <span style={{ color: "#64748B", fontSize: 13, overflowWrap: "anywhere" }}>
                      {currentUser.email}
                    </span>
                  </div>
                  <Link
                    href="/account"
                    style={{
                      display: "block",
                      marginTop: 8,
                      padding: "10px 12px",
                      borderRadius: 9,
                      color: "#1D4ED8",
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    السجل
                  </Link>
                  {currentUser.role === "admin" && (
                    <Link
                      href="/admin"
                      style={{
                        display: "block",
                        padding: "10px 12px",
                        borderRadius: 9,
                        color: "#7C3AED",
                        textDecoration: "none",
                        fontWeight: 700,
                      }}
                    >
                      لوحة الإدارة
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={logout}
                    style={{
                      width: "100%",
                      marginTop: 8,
                      padding: "10px 12px",
                      border: "none",
                      borderRadius: 9,
                      background: "transparent",
                      color: "#DC2626",
                      textAlign: "right",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              style={{
                padding: "10px 18px",
                border: "none",
                borderRadius: 11,
                background: "#2563EB",
                color: "#FFFFFF",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 5px 12px rgba(37,99,235,.22)",
              }}
            >
             {language === "ar" ? "تسجيل الدخول" : "Login"}
            </button>
          )}
        </nav>
      </header>

      <div
  className="factroot-hero"
  style={{
    position: "relative",
    zIndex: 1,
    textAlign: "center",
    marginBottom: 45,
  }}
>
  <h1
    style={{
      fontSize: 48,
      fontWeight: "bold",
      color: "#14213D",
      marginBottom: 15,
      lineHeight: 1.2,
    }}
  >
   {language === "ar"
  ? "منصة ذكية للتحقق من الأخبار"
  : "Smart News Verification Platform"}
  </h1>

  <p
    style={{
      fontSize: 22,
      color: "#6B7280",
      maxWidth: 800,
      margin: "0 auto",
      lineHeight: 1.8,
    }}
  >
   {language === "ar"
  ? "أدخل الخبر الذي تريد التحقق منه، وسنقوم بمقارنته مع المصادر الرسمية لإخبارك بالحقيقة."
  : "Enter the news you want to verify, and we will compare it with official sources to help verify the information."}
  </p>
</div>


      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={setCurrentUser}
      />

      {/* =========================
          مربع التحقق
      ========================= */}

      <section
        className="factroot-check"
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          background: "#fff",
          padding: 50,
          borderRadius: 20,
          boxShadow:
            "0 8px 25px rgba(0,0,0,0.08)",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ position: "relative" }}>
  <textarea
    disabled={imageReading}
    rows={4}
    aria-label="نص الخبر المراد التحقق منه"
    aria-describedby="voice-status"
    style={{
      width: "100%",
      boxSizing: "border-box",
      padding: "18px 18px 76px",
      borderRadius: 16,
      border: "1px solid #D1D5DB",
      fontSize: 16,
      resize: "vertical",
      outline: "none",
      lineHeight: "1.8",
      color: "#374151",
      background: "#FCFCFD",
      display: "block",
    }}
    placeholder={
  language === "ar"
    ? "📰 الصق الخبر الذي تريد التحقق منه هنا..."
    : "📰 Paste the news you want to verify here..."
}
    value={news}
    onChange={(e) => setNews(e.target.value)}
  />

  <div
    style={{
      position: "absolute",
      bottom: 16,
      right: 16,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}
  >
    <ImageNewsInput
      disabled={loading || isListening}
      onBusy={setImageReading}
      onText={(text: string) => {
        setNews(text);
        setResult(null);
        setError("");
      }}
    />
    <button
  type="button"
  className="factroot-round-button"
  onClick={startVoiceInput}
  disabled={isListening || imageReading || loading}
 aria-label={
  language === "ar"
    ? isListening
      ? "أستمع الآن"
      : "تحدث بالخبر"
    : isListening
    ? "Listening now"
    : "Speak the News"
}
  style={{
    position: "relative",
    width: 54,
    height: 54,
    padding: 0,
    display: "grid",
    placeItems: "center",
    border: "1px solid #DCE5F5",
    borderRadius: "50%",
    background: isListening ? "#DBEAFE" : "#EDF2FF",
    color: "#1769CC",
    cursor: isListening || imageReading || loading
      ? "not-allowed"
      : "pointer",
  }}
>
 <span className="factroot-button-tooltip">
  {language === "ar"
    ? "تحدث بالخبر"
    : "Speak the News"}
</span>

  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
    <path d="M12 19v3M8 22h8" />
  </svg>
</button>

    
  </div>
</div>

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          

        
        </div>

        <p
          id="voice-status"
          role="status"
          aria-live="polite"
          style={{
            minHeight: 24,
            margin: "10px 0 0",
            textAlign: "center",
            color: speechSupported ? "#4B5563" : "#B45309",
            fontSize: 14,
          }}
        >
          {voiceStatus}
        </p>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              marginTop: 15,
              padding: 12,
              borderRadius: 10,
              background: "#FDECEC",
              color: "#C62828",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 25,
          }}
        >
          <button
            onClick={guestLimitReached ? () => setAuthOpen(true) : checkNews}
            disabled={loading || imageReading}
            style={{
              width: 220,
              height: 50,
              background: loading
                ? "#93C5FD"
                : "#3B82F6",
              color: "#fff",
              border: "none",
              borderRadius: 14,
              fontSize: 17,
              fontWeight: "bold",
              cursor: loading
                ? "not-allowed"
                : "pointer",
              transition: "all 0.25s ease",
              boxShadow:
                "0 8px 18px rgba(59,130,246,0.25)",
            }}
          >
           {guestLimitReached
  ? "سجّل الدخول للمتابعة"
  : loading
  ? "⏳ جاري التحقق..."
  : language === "ar"
  ? "🔍 تحقق الآن"
  : "🔍 Verify Now"}
          </button>
        </div>

        {!currentUser && guestUsage && (
          <div
            style={{
              marginTop: 18,
              padding: 12,
              borderRadius: 10,
              background: guestUsage.remaining > 0 ? "#EFF6FF" : "#FFF7ED",
              color: guestUsage.remaining > 0 ? "#1D4ED8" : "#C2410C",
              textAlign: "center",
              fontWeight: 700,
            }}
          >
            {guestUsage.remaining > 0
              ? `تبقّى لك ${guestUsage.remaining} من أصل ${guestUsage.limit} محاولات كزائر.`
              : "انتهت محاولات الزائر. سجّلي الدخول للمتابعة بلا حد."}
          </div>
        )}

      {/* =========================
          النتيجة
      ========================= */}

      {result && (
        <section
          className="factroot-result"
          aria-live="polite"
          style={{
            marginTop: 30,
            background: "#F8FAFC",
            border: "1px solid #E5E7EB",
            padding: 20,
            borderRadius: 12,
          }}
        >
          <h2
            style={{
              marginTop: 0,
              color: "#14213D",
            }}
          >
            نتيجة التحقق
          </h2>

          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
            <button
              type="button"
              onClick={isSpeaking ? stopSpeaking : readResultAloud}
              aria-label={isSpeaking ? "إيقاف قراءة نتيجة التحقق" : "قراءة نتيجة التحقق بصوت عال"}
              style={{
                padding: "10px 16px",
                border: "1px solid #C7D2FE",
                borderRadius: 11,
                background: "#F5F3FF",
                color: "#5B21B6",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {isSpeaking ? "⏹️ إيقاف القراءة" : "🔊 قراءة النتيجة"}
            </button>
          </div>

          {/* الحالة */}

          <div
            style={{
              padding: 20,
              borderRadius: 14,
              background: hasStrongMatch
                ? "#E8F5E9"
                : "#FFF7E6",
              color: hasStrongMatch
                ? "#2E7D32"
                : "#B45309",
              fontWeight: "bold",
              fontSize: 19,
              marginBottom: 25,
              textAlign: "center",
            }}
          >
            {hasStrongMatch
              ? "✅ تم العثور على مصدر حكومي مطابق للخبر"
              : "ℹ️ لم يتم العثور على تطابق حكومي قوي"}
          </div>

          {/* أفضل مصدر */}

          {result.best_match ? (
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 15,
                padding: 25,
              }}
            >
              <h3
                style={{
                  color: "#1E3A8A",
                  marginTop: 0,
                }}
              >
                🏛️ المصدر الحكومي المطابق
              </h3>

              <p>
                <strong>الحساب الرسمي:</strong>{" "}
                {result.best_match.account}
              </p>

              <p>
                <strong>درجة التطابق:</strong>{" "}
                <span
                  style={{
                    color: "#2563EB",
                    fontWeight: "bold",
                    fontSize: 20,
                  }}
                >
                  {result.best_match.match_score}%
                </span>
              </p>

              {result.best_match.created_at && (
                <p>
                  <strong>تاريخ المنشور:</strong>{" "}
                  {new Date(
                    result.best_match.created_at
                  ).toLocaleString("ar-SA")}
                </p>
              )}

              <div
                style={{
                  marginTop: 20,
                  padding: 20,
                  background: "#fff",
                  borderRadius: 12,
                  lineHeight: 1.9,
                  color: "#374151",
                  border:
                    "1px solid #E5E7EB",
                }}
              >
                {result.best_match.text}
              </div>

              <a
                href={`https://x.com/i/status/${result.best_match.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: 18,
                  color: "#2563EB",
                  fontWeight: "bold",
                  textDecoration: "none",
                }}
              >
                🔗 عرض المنشور الرسمي في X
              </a>
            </div>
          ) : (
            <div
              style={{
                padding: 25,
                borderRadius: 14,
                background: "#F8FAFC",
                color: "#6B7280",
                textAlign: "center",
              }}
            >
              لم يتم العثور على منشور حكومي مطابق
              لهذا الخبر حاليًا.
            </div>
          )}

          {/* المنشورات المرتبطة */}

          {result.results.some(
            (item) => item.posts.length > 0
          ) && (
            <div style={{ marginTop: 35 }}>
              <h3
                style={{
                  color: "#1E3A8A",
                }}
              >
                المنشورات الحكومية المرتبطة
              </h3>

              {result.results.map(
                (accountResult) =>
                  accountResult.posts.length > 0 && (
                    <div
                      key={accountResult.account}
                      style={{
                        marginTop: 20,
                      }}
                    >
                      <h4
                        style={{
                          color: "#14213D",
                          fontSize: 17,
                        }}
                      >
                        {accountResult.account}
                      </h4>

                      {accountResult.posts.map(
                        (post) => (
                          <div
                            key={post.id}
                            style={{
                              background: "#F8FAFC",
                              borderRadius: 12,
                              padding: 18,
                              marginBottom: 12,
                              border:
                                "1px solid #E2E8F0",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent:
                                  "space-between",
                                gap: 15,
                                flexWrap: "wrap",
                                marginBottom: 10,
                              }}
                            >
                              <strong>
                                درجة التطابق:{" "}
                                {post.match_score}%
                              </strong>

                              {post.created_at && (
                                <span
                                  style={{
                                    color:
                                      "#6B7280",
                                    fontSize: 13,
                                  }}
                                >
                                  {new Date(
                                    post.created_at
                                  ).toLocaleString(
                                    "ar-SA"
                                  )}
                                </span>
                              )}
                            </div>

                            <p
                              style={{
                                color: "#374151",
                                lineHeight: 1.8,
                              }}
                            >
                              {post.text}
                            </p>

                            <a
                              href={`https://x.com/i/status/${post.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "#2563EB",
                                textDecoration:
                                  "none",
                                fontWeight: "bold",
                              }}
                            >
                              عرض المنشور ↗
                            </a>
                          </div>
                        )
                      )}
                    </div>
                  )
              )}
            </div>
          )}
        </section>
      )}

      </section>
    <div
  style={{
    maxWidth: 1100,
    margin: "60px auto 0",
  }}
>
  <div
  style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 15,
    marginBottom: 35,
  }}
>
  <div
    style={{
      width: 80,
      height: 2,
      background: "#1E3A8A",
      position: "relative",
    }}
  >
    <div
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "#1E3A8A",
        position: "absolute",
        right: -3,
        top: -2.5,
      }}
    />
  </div>

  <h2
    style={{
       color: "#1E3A8A",

      fontSize: 30,
      margin: 0,
    }}
  >
   {language === "ar" ? "لماذا FactRoot؟" : "Why FactRoot?"}
  </h2>

  <div
    style={{
      width: 80,
      height: 2,
      background: "#1E3A8A",
      position: "relative",
    }}
  >
    <div
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "#1E3A8A",
        position: "absolute",
        left: -3,
        top: -2.5,
      }}
    />
  </div>
</div>

  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      gap: 20,
      flexWrap: "wrap",
    }}
  >
    <div
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-8px)";
    e.currentTarget.style.boxShadow = "0 15px 35px rgba(0,0,0,0.12)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)";
  }}
  style={{
    flex: 1,
    minWidth: 250,
    background: "#fff",
    padding: 20,
    borderRadius: 16,
    boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
    textAlign: "center",
    transition: "0.3s",
    cursor: "pointer",
  }}
>
      <div style={{ fontSize: 52 }}>🛡️</div>

      <h3 style={{ color: "#1E3A8A" }}>
       {language === "ar" ? "مصادر رسمية" : "Official Sources"}
      </h3>

      <p style={{ color: "#6B7280", lineHeight: 1.8 }}>
       {language === "ar"
  ? "يعتمد FactRoot على مصادر موثوقة للتحقق من صحة الأخبار."
  : "FactRoot relies on trusted official sources to verify news."}
      </p>
    </div>

    <div
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-8px)";
    e.currentTarget.style.boxShadow = "0 15px 35px rgba(0,0,0,0.12)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)";
  }}
  style={{
    flex: 1,
    minWidth: 250,
    background: "#fff",
    padding: 20,
    borderRadius: 16,
    boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
    textAlign: "center",
    transition: "0.3s",
    cursor: "pointer",
  }}
>
      <div style={{ fontSize: 52 }}>🤖</div>

      <h3 style={{ color: "#1E3A8A" }}>
       {language === "ar" ? "ذكاء اصطناعي" : "Artificial Intelligence"}
      </h3>

      <p style={{ color: "#6B7280", lineHeight: 1.8 }}>
       {language === "ar"
  ? "يحلل الخبر ويقارنه بالمصادر الرسمية لإعطاء نتيجة دقيقة."
  : "It analyzes the news and compares it with official sources to provide an accurate result."}
      </p>
    </div>

    <div
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-8px)";
    e.currentTarget.style.boxShadow = "0 15px 35px rgba(0,0,0,0.12)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)";
  }}
  style={{
    flex: 1,
    minWidth: 250,
    background: "#fff",
    padding: 20,
    borderRadius: 16,
    boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
    textAlign: "center",
    transition: "0.3s",
    cursor: "pointer",
  }}
>
      <div style={{ fontSize: 52 }}>⚡</div>

      <h3 style={{ color: "#1E3A8A" }}>
       {language === "ar" ? "نتائج سريعة" : "Fast Results"}
      </h3>

      <p style={{ color: "#6B7280", lineHeight: 1.8 }}>
       {language === "ar"
  ? "احصل على نتيجة التحقق خلال ثوانٍ مع عرض المصادر المرتبطة."
  : "Get verification results within seconds with related sources displayed."}
      </p>
    </div>
  </div>
</div>
{/* كيف يعمل؟ */}

<div
  id="how-it-works"
  style={{
    marginTop: 80,
    textAlign: "center",
  }}
>
  <h2
    style={{
      fontSize: 38,
      color: "#14213D",
      fontWeight: "bold",
      marginBottom: 10,
    }}
  >
   {language === "ar" ? "كيف يعمل؟" : "How It Works?"}
  </h2>

  <p
    style={{
      color: "#6B7280",
      fontSize: 18,
      marginBottom: 45,
    }}
  >
   {language === "ar"
  ? "تحقق من الأخبار في ثلاث خطوات بسيطة"
  : "Verify news in three simple steps"}
  </p>

  <div
    style={{
      display: "flex",
      gap: 25,
      justifyContent: "center",
      flexWrap: "wrap",
    }}
  >

    <div
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-8px)";
    e.currentTarget.style.boxShadow = "0 15px 35px rgba(0,0,0,0.12)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.08)";
  }}
  style={{
    width: 300,
    background: "#fff",
    borderRadius: 18,
    padding: 30,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    transition: "0.3s",
    cursor: "pointer",
  }}
>
      <div style={{ fontSize: 45 }}>📰</div>

      <h3 style={{ color: "#14213D" }}>
       {language === "ar" ? "أدخل الخبر" : "Enter the News"}
      </h3>

      <p style={{ color: "#6B7280" }}>
      {language === "ar"
  ? "الصق الخبر الذي تريد التحقق منه داخل مربع البحث."
  : "Paste the news you want to verify into the search box."}
      </p>
    </div>

    <div
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-8px)";
    e.currentTarget.style.boxShadow = "0 15px 35px rgba(0,0,0,0.12)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.08)";
  }}
  style={{
    width: 300,
    background: "#fff",
    borderRadius: 18,
    padding: 30,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    transition: "0.3s",
    cursor: "pointer",
  }}
>
      <div style={{ fontSize: 45 }}>🤖</div>

      <h3 style={{ color: "#14213D" }}>
       {language === "ar" ? "تحليل ذكي" : "Smart Analysis"}
      </h3>

      <p style={{ color: "#6B7280" }}>
       {language === "ar"
  ? "يقوم FactRoot بمقارنة الخبر مع المصادر الرسمية باستخدام الذكاء الاصطناعي."
  : "FactRoot compares the news with official sources using artificial intelligence."}
      </p>
    </div>

    <div
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-8px)";
    e.currentTarget.style.boxShadow = "0 15px 35px rgba(0,0,0,0.12)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.08)";
  }}
  style={{
    width: 300,
    background: "#fff",
    borderRadius: 18,
    padding: 30,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    transition: "0.3s",
    cursor: "pointer",
  }}
>
      <div style={{ fontSize: 45 }}>✅</div>

      <h3 style={{ color: "#14213D" }}>
       {language === "ar" ? "اعرض النتيجة" : "View the Result"}
      </h3>

      <p style={{ color: "#6B7280" }}>
      {language === "ar"
  ? "تحصل على نتيجة التحقق مع المصدر الرسمي إذا كان الخبر موثقًا."
  : "View the verification result along with the official source when a match is found."}
      </p>
    </div>

  </div>
</div>



{/* ================= من نحن ================= */}
<div

  id="about"

  style={{

    maxWidth: 1100,

    margin: "90px auto",

    background: "#fff",

    borderRadius: 20,

    padding: "50px",

    boxShadow: "0 8px 25px rgba(0,0,0,0.08)",

    textAlign: "center",

  }}

>

  <div style={{ fontSize: 55, marginBottom: 15 }}>

    🛡️

  </div>



  <h2

    style={{

      color: "#14213D",
      fontSize: 32,

      marginBottom: 20,

    }}

  >

    {language === "ar" ? "من نحن؟" : "About Us"}

  </h2>



  <p

    style={{

      color: "#6B7280",

      fontSize: 18,

      lineHeight: 2,

      maxWidth: 850,

      margin: "0 auto",

    }}

  >

    {language === "ar" ? (
  <>
    <strong>FactRoot</strong> هي منصة ذكية للتحقق من صحة الأخبار باستخدام
    تقنيات الذكاء الاصطناعي ومقارنة الأخبار بالمصادر الرسمية الموثوقة.
    نهدف إلى الحد من انتشار الأخبار المضللة ومساعدة المستخدمين على الوصول
    إلى المعلومات الصحيحة بسرعة وموثوقية.
  </>
) : (
  <>
    <strong>FactRoot</strong> is an intelligent platform for verifying news
    using artificial intelligence and comparing information with trusted
    official sources. Our goal is to reduce the spread of misinformation and
    help users access accurate information quickly and reliably.
  </>
)}
  </p>

</div>
{/* ================= Footer ================= */}

<footer

  style={{

    marginTop: 100,

    background: "#14213D",

    color: "#fff",

    borderRadius: 0,

    padding: "10px 30px",

  }}

>

  <div

    style={{

      maxWidth: 1100,

      margin: "0 auto",

      display: "flex",

      justifyContent: "space-between",

      alignItems: "center",

      flexWrap: "wrap",

      gap: 10,

    }}

  >

    {/* اللوقو */}

    <div>

      <h2

        style={{

          margin: 0,

          fontSize: 26,

        }}

      >

        🛡 FactRoot

      </h2>



      <p

        style={{

          marginTop: 6,

          color: "#D1D5DB",

          lineHeight: 1.8,

          maxWidth: 280,

        }}

      >
{language === "ar"
  ? "منصة ذكية للتحقق من الأخبار باستخدام الذكاء الاصطناعي والمصادر الرسمية الموثوقة."
  : "An intelligent platform for verifying news using artificial intelligence and trusted official sources."}

      </p>

    </div>


  </div>



  <hr

    style={{

      margin: "15px 0 10px",

      border: "none",

      borderTop: "1px solid rgba(255,255,255,.2)",

    }}

  />



  <p

    style={{

      textAlign: "center",

      color: "#CBD5E1",

      margin: 0,

    }}

  >

    © 2026 FactRoot. All Rights Reserved.

  </p>

</footer>
      {/* =========================
          زر الرجوع للأعلى
      ========================= */}

      {showTopButton && (
        <button
          aria-label="العودة إلى أعلى الصفحة"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            })
          }
          style={{
            position: "fixed",
            bottom: 30,
            right: 30,
            width: 55,
            height: 55,
            borderRadius: "50%",
            border: "none",
            background: "#2563EB",
            color: "#fff",
            fontSize: 20,
            cursor: "pointer",
            boxShadow:
              "0 6px 15px rgba(0,0,0,0.2)",
            zIndex: 20,
          }}
        >
          ↑
        </button>
      )}
    </main>
  );
}
