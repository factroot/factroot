"use client";

import { FormEvent, useEffect, useState } from "react";

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
};

export default function AuthModal({ isOpen, onClose, onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

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
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { name, email, password } : { email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || "تعذر إكمال العملية. حاولي مرة أخرى.");
        return;
      }
      onAuthenticated(data.user);
      setName("");
      setEmail("");
      setPassword("");
      setConfirmation("");
      onClose();
    } catch {
      setError("تعذر الاتصال بالخادم. تأكدي أن Backend يعمل.");
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
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
        dir="rtl"
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
          aria-label="إغلاق"
          style={{ position: "absolute", top: 18, left: 18, border: 0, background: "transparent", color: "#94A3B8", fontSize: 30, cursor: "pointer" }}
        >
          ×
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" width={54} height={54} alt="شعار FactRoot" />
          <strong style={{ fontSize: 25, color: "#111827" }}>FactRoot</strong>
        </div>

        <h2 id="auth-title" style={{ margin: "24px 0 6px", color: "#111827", fontSize: 29 }}>
          {mode === "login" ? "تسجيل الدخول إلى FactRoot" : "إنشاء حساب جديد"}
        </h2>
        <p style={{ margin: "0 0 24px", color: "#64748B", lineHeight: 1.8 }}>
          {mode === "login" ? "ادخلي إلى حسابك للوصول إلى سجل التحققات وميزاتك الخاصة." : "أنشئي حسابك لحفظ عمليات التحقق والرجوع إليها لاحقًا."}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 5, marginBottom: 24, borderRadius: 13, background: "#EFF5FF" }}>
          {(["login", "register"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => switchMode(item)}
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
              {item === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 17 }}>
          {mode === "register" && (
            <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
              الاسم
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} placeholder="اكتبي اسمك" style={fieldStyle} />
            </label>
          )}
          <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
            البريد الإلكتروني
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="name@domain.com" dir="ltr" style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
            كلمة المرور
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} placeholder="8 أحرف على الأقل" style={fieldStyle} />
          </label>
          {mode === "register" && (
            <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
              تأكيد كلمة المرور
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required minLength={8} placeholder="أعيدي كتابة كلمة المرور" style={fieldStyle} />
            </label>
          )}
          {error && <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#FEF2F2", color: "#B91C1C", textAlign: "center", fontWeight: 700 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: 4, height: 54, border: 0, borderRadius: 12, background: loading ? "#93B4FA" : "#1761F5", color: "#fff", fontSize: 17, fontWeight: 800, cursor: loading ? "wait" : "pointer", boxShadow: "0 7px 16px rgba(23,97,245,.24)" }}
          >
            {loading ? "جاري التنفيذ..." : mode === "login" ? "تسجيل الدخول ←" : "إنشاء الحساب ←"}
          </button>
        </form>
      </section>
    </div>
  );
}
