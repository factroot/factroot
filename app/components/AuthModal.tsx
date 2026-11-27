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

type AuthMode = "login" | "register" | "forgot" | "verify" | "reset";

export default function AuthModal({ isOpen, onClose, onAuthenticated, language }: Props) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
        forgotTitle: "استعادة كلمة المرور",
        forgotDescription: "أدخلي البريد الإلكتروني المرتبط بحسابك لنرسل لك رمز استعادة مؤقتًا.",
        verifyTitle: "التحقق من البريد الإلكتروني",
        verifyDescription: "أدخلي رمز التحقق المكوّن من 6 أرقام الذي أرسلناه إلى بريدك الإلكتروني.",
        resetTitle: "إنشاء كلمة مرور جديدة",
        resetDescription: "اختاري كلمة مرور جديدة لحساب FactRoot.",
        login: "تسجيل الدخول",
        register: "إنشاء حساب",
        name: "الاسم",
        namePlaceholder: "اكتبي اسمك",
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        passwordPlaceholder: "8 أحرف على الأقل",
        confirmation: "تأكيد كلمة المرور",
        confirmationPlaceholder: "أعيدي كتابة كلمة المرور",
        forgotLink: "نسيتِ كلمة المرور؟",
        sendCode: "إرسال رمز الاستعادة",
        code: "رمز التحقق",
        codePlaceholder: "000000",
        verifyCode: "التحقق من الرمز",
        resendCode: "لم يصلك الرمز؟ طلب رمز جديد",
        changeEmail: "تغيير البريد الإلكتروني",
        newPassword: "كلمة المرور الجديدة",
        newPasswordPlaceholder: "8 أحرف على الأقل",
        newPasswordConfirmation: "تأكيد كلمة المرور الجديدة",
        changePassword: "تغيير كلمة المرور",
        backToLogin: "العودة إلى تسجيل الدخول",
        loading: "جاري التنفيذ...",
        mismatch: "كلمتا المرور غير متطابقتين.",
        invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        invalidCode: "رمز التحقق غير صحيح أو انتهت صلاحيته. اطلبي رمزًا جديدًا.",
        invalidReset: "انتهت جلسة الاستعادة. ابدئي العملية من جديد.",
        codeSent: "إذا كان البريد مسجلًا ونشطًا، فسيصلك رمز الاستعادة. تحققي من صندوق الوارد والرسائل غير المرغوب فيها.",
        codeVerified: "تم التحقق من الرمز. يمكنك الآن تعيين كلمة مرور جديدة.",
        passwordChanged: "تم تغيير كلمة المرور بنجاح. سجّلي الدخول باستخدام كلمة المرور الجديدة.",
        emailError: "أدخلي بريدًا إلكترونيًا صحيحًا.",
        mailServiceError: "تعذر إرسال البريد الإلكتروني. تحققي من إعداد Gmail في Backend ثم حاولي مرة أخرى.",
        genericError: "تعذر إكمال العملية. حاولي مرة أخرى.",
        connectionError: "تعذر الاتصال بالخادم. تأكدي أن Backend يعمل.",
      }
    : {
        close: "Close account dialog",
        loginTitle: "Sign in to FactRoot",
        registerTitle: "Create a new account",
        loginDescription: "Sign in to access your history and account features.",
        registerDescription: "Create an account to save and revisit your verification history.",
        forgotTitle: "Reset your password",
        forgotDescription: "Enter the email address linked to your account and we will send a temporary reset code.",
        verifyTitle: "Verify your email",
        verifyDescription: "Enter the 6-digit verification code sent to your email address.",
        resetTitle: "Create a new password",
        resetDescription: "Choose a new password for your FactRoot account.",
        login: "Sign In",
        register: "Create Account",
        name: "Name",
        namePlaceholder: "Enter your name",
        email: "Email address",
        password: "Password",
        passwordPlaceholder: "At least 8 characters",
        confirmation: "Confirm password",
        confirmationPlaceholder: "Enter the password again",
        forgotLink: "Forgot password?",
        sendCode: "Send reset code",
        code: "Verification code",
        codePlaceholder: "000000",
        verifyCode: "Verify code",
        resendCode: "Didn't receive the code? Request another",
        changeEmail: "Change email address",
        newPassword: "New password",
        newPasswordPlaceholder: "At least 8 characters",
        newPasswordConfirmation: "Confirm new password",
        changePassword: "Change password",
        backToLogin: "Back to sign in",
        loading: "Please wait...",
        mismatch: "The passwords do not match.",
        invalidCredentials: "Invalid email or password.",
        invalidCode: "The verification code is incorrect or expired. Request a new code.",
        invalidReset: "The reset session has expired. Start the process again.",
        codeSent: "If this email is registered and active, a reset code has been sent. Check your inbox and spam folder.",
        codeVerified: "The code is verified. You can now create a new password.",
        passwordChanged: "Your password has been changed. Sign in with your new password.",
        emailError: "Enter a valid email address.",
        mailServiceError: "The email could not be sent. Check the Gmail settings in the backend and try again.",
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

  function clearRecoveryState() {
    setResetCode("");
    setResetToken("");
    setNewPassword("");
    setNewPasswordConfirmation("");
    setSuccess("");
  }

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmation("");
    clearRecoveryState();
  }

  function startPasswordRecovery() {
    setMode("forgot");
    setError("");
    setSuccess("");
    setPassword("");
    setResetCode("");
    setResetToken("");
    setNewPassword("");
    setNewPasswordConfirmation("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (mode === "register" && password !== confirmation) {
      setError(copy.mismatch);
      return;
    }
    if (mode === "reset" && newPassword !== newPasswordConfirmation) {
      setError(copy.mismatch);
      return;
    }

    let endpoint = "";
    let payload: Record<string, string> = {};
    if (mode === "login" || mode === "register") {
      endpoint = mode;
      payload = mode === "register" ? { name, email, password } : { email, password };
    } else if (mode === "forgot") {
      endpoint = "forgot-password";
      payload = { email };
    } else if (mode === "verify") {
      endpoint = "verify-reset-code";
      payload = { email, code: resetCode };
    } else {
      endpoint = "reset-password";
      payload = { reset_token: resetToken, new_password: newPassword };
    }

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/auth/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (mode === "login" && response.status === 401) {
          setError(copy.invalidCredentials);
        } else if (mode === "forgot" && response.status === 503) {
          setError(copy.mailServiceError);
        } else if (mode === "verify" && response.status === 400) {
          setError(language === "ar" ? (data.detail || copy.invalidCode) : copy.invalidCode);
        } else if (mode === "reset" && response.status === 400) {
          setError(language === "ar" ? (data.detail || copy.invalidReset) : copy.invalidReset);
        } else {
          setError(language === "ar" ? (data.detail || copy.genericError) : copy.genericError);
        }
        return;
      }

      if (mode === "login" || mode === "register") {
        onAuthenticated(data.user);
        setName("");
        setEmail("");
        setPassword("");
        setConfirmation("");
        onClose();
      } else if (mode === "forgot") {
        setMode("verify");
        setSuccess(copy.codeSent);
      } else if (mode === "verify") {
        if (!data.reset_token) {
          setError(copy.genericError);
          return;
        }
        setResetToken(data.reset_token);
        setResetCode("");
        setMode("reset");
        setSuccess(copy.codeVerified);
      } else {
        setMode("login");
        setPassword("");
        setConfirmation("");
        clearRecoveryState();
        setSuccess(copy.passwordChanged);
      }
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

  const title = mode === "login" ? copy.loginTitle
    : mode === "register" ? copy.registerTitle
    : mode === "forgot" ? copy.forgotTitle
    : mode === "verify" ? copy.verifyTitle
    : copy.resetTitle;
  const description = mode === "login" ? copy.loginDescription
    : mode === "register" ? copy.registerDescription
    : mode === "forgot" ? copy.forgotDescription
    : mode === "verify" ? copy.verifyDescription
    : copy.resetDescription;
  const submitLabel = loading ? copy.loading
    : mode === "login" ? copy.login
    : mode === "register" ? copy.register
    : mode === "forgot" ? copy.sendCode
    : mode === "verify" ? copy.verifyCode
    : copy.changePassword;

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
          {title}
        </h2>
        <p id="auth-description" style={{ margin: "0 0 24px", color: "#64748B", lineHeight: 1.8 }}>
          {description}
        </p>

        {(mode === "login" || mode === "register") && (
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
        )}

        <form id="auth-form" aria-busy={loading} onSubmit={submit} style={{ display: "grid", gap: 17 }}>
          {mode === "register" && (
            <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
              {copy.name}
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} placeholder={copy.namePlaceholder} style={fieldStyle} />
            </label>
          )}

          {mode !== "reset" && (
            <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
              {copy.email}
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required readOnly={mode === "verify"} placeholder="name@domain.com" dir="ltr" style={{ ...fieldStyle, ...(mode === "verify" ? { background: "#EEF2F7", color: "#64748B" } : {}) }} />
            </label>
          )}

          {(mode === "login" || mode === "register") && (
            <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
              {copy.password}
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128} placeholder={copy.passwordPlaceholder} style={fieldStyle} />
            </label>
          )}

          {mode === "register" && (
            <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
              {copy.confirmation}
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={128} placeholder={copy.confirmationPlaceholder} style={fieldStyle} />
            </label>
          )}

          {mode === "verify" && (
            <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
              {copy.code}
              <input type="text" value={resetCode} onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder={copy.codePlaceholder} dir="ltr" style={{ ...fieldStyle, textAlign: "center", letterSpacing: 8, fontSize: 22 }} />
            </label>
          )}

          {mode === "reset" && (
            <>
              <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
                {copy.newPassword}
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={128} placeholder={copy.newPasswordPlaceholder} style={fieldStyle} />
              </label>
              <label style={{ display: "grid", gap: 7, color: "#334155", fontWeight: 700 }}>
                {copy.newPasswordConfirmation}
                <input type="password" value={newPasswordConfirmation} onChange={(event) => setNewPasswordConfirmation(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={128} placeholder={copy.confirmationPlaceholder} style={fieldStyle} />
              </label>
            </>
          )}

          {error && <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#FEF2F2", color: "#B91C1C", textAlign: "center", fontWeight: 700 }}>{error}</div>}
          {success && <div role="status" aria-live="polite" style={{ padding: 12, borderRadius: 10, background: "#EFFAF3", color: "#166534", textAlign: "center", fontWeight: 700, lineHeight: 1.7 }}>{success}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: 4, height: 54, border: 0, borderRadius: 12, background: loading ? "#93B4FA" : "#1761F5", color: "#fff", fontSize: 17, fontWeight: 800, cursor: loading ? "wait" : "pointer", boxShadow: "0 7px 16px rgba(23,97,245,.24)" }}
          >
            {submitLabel}
          </button>

          {mode === "login" && (
            <button type="button" onClick={startPasswordRecovery} style={{ justifySelf: "center", border: 0, background: "transparent", color: "#1761F5", fontWeight: 700, cursor: "pointer", padding: 4 }}>
              {copy.forgotLink}
            </button>
          )}
          {mode === "verify" && (
            <button type="button" onClick={startPasswordRecovery} style={{ justifySelf: "center", border: 0, background: "transparent", color: "#1761F5", fontWeight: 700, cursor: "pointer", padding: 4 }}>
              {copy.resendCode}
            </button>
          )}
          {(mode === "forgot" || mode === "verify" || mode === "reset") && (
            <button type="button" onClick={() => switchMode("login")} style={{ justifySelf: "center", border: 0, background: "transparent", color: "#64748B", fontWeight: 700, cursor: "pointer", padding: 4 }}>
              {copy.backToLogin}
            </button>
          )}
        </form>
      </section>
    </div>
  );
}
