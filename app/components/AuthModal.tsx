"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
  language: "ar" | "en";
};

export default function AuthModal({ isOpen, onClose, onAuthenticated, language }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  const copy = language === "ar"
    ? {
        close: "إغلاق نافذة الحساب",
        loginTitle: "تسجيل الدخول إلى FactRoot",
        registerTitle: "إنشاء حساب جديد",
        loginDescription: "ادخلي إلى حسابك للوصول إلى السجل وميزاتك الخاصة.",
        registerDescription: "أنشئي حسابك لحفظ عمليات التحقق والرجوع إليها لاحقًا.",
        login: "تسجيل الدخول",
        register: "إنشاء حساب",
        name: "الاسم",
        namePlaceholder: "اكتبي اسمك",
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        passwordPlaceholder: "8 أحرف على الأقل",
        confirmation: "تأكيد كلمة المرور",
        confirmationPlaceholder: "أعيدي كتابة كلمة المرور",
        loading: "جاري التنفيذ...",
        mismatch: "كلمتا المرور غير متطابقتين.",
        invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        genericError: "تعذر إكمال العملية. حاولي مرة أخرى.",
        connectionError: "تعذر الاتصال بالخادم. تأكدي أن Backend يعمل.",
      }
    : {
        close: "Close account dialog",
        loginTitle: "Sign in to FactRoot",
        registerTitle: "Create a new account",
        loginDescription: "Sign in to access your history and account features.",
        registerDescription: "Create an account to save and revisit your verification history.",
        login: "Sign In",
        register: "Create Account",
        name: "Name",
        namePlaceholder: "Enter your name",
        email: "Email address",
        password: "Password",
        passwordPlaceholder: "At least 8 characters",
        confirmation: "Confirm password",
        confirmationPlaceholder: "Enter the password again",
        loading: "Please wait...",
        mismatch: "The passwords do not match.",
        invalidCredentials: "Invalid email or password.",
        genericError: "The request could not be completed. Please try again.",
        connectionError: "The server could not be reached. Make sure the backend is running.",
      };

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      const initialField = dialogRef.current?.querySelector<HTMLElement>(
        'input:not([disabled])'
      );
      const fallbackButton = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled])'
      );
      (initialField || fallbackButton)?.focus();
    }, 0);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKey);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmation("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmation) {
      setError(copy.mismatch);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/auth/${mode}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
        mode === "register"
            ? { name, email, password }
            : { email, password }
    ),
});

const data = await response.json();

if (!response.ok) {
    if (mode === "login" && response.status === 401) {
        setError(copy.invalidCredentials);
    } else {
        setError(data.detail || copy.genericError);
    }
    return;
}

onAuthenticated(data.user);
      setName("");
      setEmail("");
      setPassword("");
      setConfirmation("");
      onClose();
    } catch {
      setError(copy.connectionError);
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "14px 16px",
    border: "1px solid #D7DEEA",
    borderRadius: 12,
    background: "#F8FAFD",
    color: "#172033",
    fontSize: 16,
    outline: "none",
  };

  return (
    <div
      ref={dialogRef}
      lang={language}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      aria-describedby="auth-description"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(15,23,42,.68)",
        backdropFilter: "blur(4px)",
      }}
    >
      <section
        dir={language === "ar" ? "rtl" : "ltr"}
        style={{
          width: "100%",
          maxWidth: 570,
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 22,
          boxShadow: "0 25px 70px rgba(15,23,42,.3)",
          padding: "28px 34px 32px",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          style={{ position: "absolute", top: 18, left: 18, border: 0, background: "transparent", color: "#94A3B8", fontSize: 30, cursor: "pointer" }}
        >
          ×
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" width={54} height={54} alt="" />
          <strong style={{ fontSize: 25, color: "#111827" }}>FactRoot</strong>
        </div>

        <h2 id="auth-title" style={{ margin: "24px 0 6px", color: "#111827", fontSize: 29 }}>
          {mode === "login" ? copy.loginTitle : copy.registerTitle}
        </h2>
        <p id="auth-description" style={{ margin: "0 0 24px", color: "#64748B", lineHeight: 1.8 }}>
          {mode === "login" ? copy.loginDescription : copy.registerDescription}
        </p>

        <div role="tablist" aria-label={language === "ar" ? "نوع عملية الحساب" : "Account action"} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 5, marginBottom: 24, borderRadius: 13, background: "#EFF5FF" }}>
          {(["login", "register"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => switchMode(item)}
              role="tab"
              aria-selected={mode === item}
              aria-controls="auth-form"
              style={{
                padding: 11,
                border: 0,
                borderRadius: 10,
                background: mode === item ? "#fff" : "transparent",
                color: mode === item ? "#155EEF" : "#64748B",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                boxShadow: mode === item ? "0 2px 8px rgba(15,23,42,.08)" : "none",
              }}
            >
              {item === "login" ? copy.login : copy.register}
            </button>
          ))}
        </div>

        <form id="auth-form" aria-busy={loading} onSubmit={submit} style={{ display: "grid", gap: 17 }}>
          {mode === "register" && (
            <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
              {copy.name}
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} placeholder={copy.namePlaceholder} style={fieldStyle} />
            </label>
          )}
          <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
            {copy.email}
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="name@domain.com" dir="ltr" style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
            {copy.password}
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} placeholder={copy.passwordPlaceholder} style={fieldStyle} />
          </label>
          {mode === "register" && (
            <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
              {copy.confirmation}
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required minLength={8} placeholder={copy.confirmationPlaceholder} style={fieldStyle} />
            </label>
          )}
          {error && <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#FEF2F2", color: "#B91C1C", textAlign: "center", fontWeight: 700 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: 4, height: 54, border: 0, borderRadius: 12, background: loading ? "#93B4FA" : "#1761F5", color: "#fff", fontSize: 17, fontWeight: 800, cursor: loading ? "wait" : "pointer", boxShadow: "0 7px 16px rgba(23,97,245,.24)" }}
          >
            {loading ? copy.loading : mode === "login" ? copy.login : copy.register}
          </button>
        </form>
      </section>
    </div>
  );
}
