 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthUser } from "../components/AuthModal";

type Stats = {
  users: number;
  active_users: number;
  suspended_users: number;
  checks: number;
  registered_checks: number;
  guest_checks: number;
};

type ManagedUser = AuthUser & {
  is_active: boolean;
  created_at: number;
};

type TrustedSource = {
  id: number;
  account: string;
  label: string;
  is_active: boolean;
  created_at: number;
};

type ActivityItem = {
  id: number;
  actor_type: "user" | "guest";
  actor_name: string | null;
  status: string;
  match_score: number | null;
  created_at: number;
};

export default function AdminPage() {
  const [admin, setAdmin] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [sources, setSources] = useState<TrustedSource[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceAccount, setSourceAccount] = useState("");
  const [addingSource, setAddingSource] = useState(false);

  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [darkMode, setDarkMode] = useState(false);
  const isArabic = language === "ar";

  useEffect(() => {
    let savedLanguage: "ar" | "en" = "ar";
    let savedDarkMode = false;
    try {
      const storedLanguage = localStorage.getItem("factroot-language");
      if (storedLanguage === "ar" || storedLanguage === "en") {
        savedLanguage = storedLanguage;
      }
      savedDarkMode = localStorage.getItem("factroot-dark-mode") === "true";
    } catch {}

    setLanguage(savedLanguage);
    setDarkMode(savedDarkMode);
    document.documentElement.lang = savedLanguage;
    document.documentElement.dir = savedLanguage === "ar" ? "rtl" : "ltr";
    document.documentElement.classList.toggle("factroot-dark", savedDarkMode);
  }, []);

  function changeLanguage(nextLanguage: "ar" | "en") {
    setLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem("factroot-language", nextLanguage);
    } catch {}
  }

  function changeTheme(nextDarkMode: boolean) {
    setDarkMode(nextDarkMode);
    document.documentElement.classList.toggle("factroot-dark", nextDarkMode);
    try {
      localStorage.setItem("factroot-dark-mode", String(nextDarkMode));
    } catch {}
  }

  const t = {
    dashboard: isArabic ? "لوحة الإدارة" : "Admin Dashboard",
    site: isArabic ? "الموقع" : "Website",
    logout: isArabic ? "تسجيل الخروج" : "Log Out",
    welcome: isArabic ? "مرحبًا،" : "Welcome,",
    overview: isArabic ? "نظرة عامة" : "Overview",
    overviewDescription: isArabic
      ? "إحصائيات المستخدمين وعمليات التحقق في FactRoot."
      : "FactRoot user and verification statistics.",
    loading: isArabic ? "جاري تحميل لوحة الإدارة..." : "Loading admin dashboard...",
    backendError: isArabic
      ? "تعذر تحميل لوحة الإدارة. تأكدي أن Backend يعمل."
      : "Could not load the admin dashboard. Make sure the backend is running.",
    updateError: isArabic ? "تعذر تحديث الحساب." : "Could not update the user.",
    sourceUpdateError: isArabic ? "تعذر تحديث المصدر." : "Could not update the source.",
    addSourceError: isArabic ? "تعذر إضافة المصدر." : "Could not add the source.",
    connectionError: isArabic ? "تعذر الاتصال بالخادم." : "Could not connect to the server.",
    accessTitle: isArabic ? "ليس لديك صلاحية" : "Access denied",
    accessDescription: isArabic
      ? "هذه الصفحة مخصصة لحساب المدير فقط."
      : "This page is available to administrators only.",
    backHome: isArabic ? "العودة للرئيسية" : "Back to Home",
    users: isArabic ? "المستخدمون" : "Users",
    activeUsers: isArabic ? "الحسابات النشطة" : "Active Users",
    suspendedUsers: isArabic ? "الحسابات الموقوفة" : "Suspended Users",
    checks: isArabic ? "عمليات التحقق" : "Verification Checks",
    manageUsers: isArabic ? "إدارة المستخدمين" : "User Management",
    name: isArabic ? "الاسم" : "Name",
    email: isArabic ? "البريد الإلكتروني" : "Email",
    role: isArabic ? "النوع" : "Role",
    registered: isArabic ? "تاريخ التسجيل" : "Registered",
    status: isArabic ? "الحالة" : "Status",
    action: isArabic ? "الإجراء" : "Action",
    admin: isArabic ? "مدير" : "Admin",
    user: isArabic ? "مستخدم" : "User",
    active: isArabic ? "نشط" : "Active",
    suspended: isArabic ? "موقوف" : "Suspended",
    activating: isArabic ? "جاري..." : "Updating...",
    deactivate: isArabic ? "إيقاف" : "Suspend",
    activate: isArabic ? "تفعيل" : "Activate",
    sources: isArabic ? "المصادر الموثوقة" : "Trusted Sources",
    sourcesDescription: isArabic
      ? "حسابات X الرسمية التي يستخدمها الموقع للتحقق."
      : "Official X accounts used by the system for verification.",
    sourceName: isArabic ? "اسم الجهة" : "Source name",
    sourceAccount: isArabic ? "حساب X مثل DgaGovSa" : "X account, e.g. DgaGovSa",
    addSource: isArabic ? "إضافة مصدر" : "Add Source",
    adding: isArabic ? "جاري..." : "Adding...",
    deactivateSource: isArabic ? "تعطيل" : "Deactivate",
    activateSource: isArabic ? "تفعيل" : "Activate",
    recentActivity: isArabic ? "نشاط التحقق الأخير" : "Recent Verification Activity",
    activityDescription: isArabic
      ? "نعرض نوع المستخدم والنتيجة فقط، دون نص الخبر حفاظًا على الخصوصية."
      : "Only the user type and result are shown; news text is not displayed for privacy.",
    noActivity: isArabic ? "لا يوجد نشاط حتى الآن." : "No activity yet.",
    actor: isArabic ? "المنفذ" : "Actor",
    result: isArabic ? "النتيجة" : "Result",
    bestMatch: isArabic ? "أفضل تطابق" : "Best Match",
    date: isArabic ? "التاريخ" : "Date",
    guest: isArabic ? "زائر" : "Guest",
    unnamedUser: isArabic ? "مستخدم" : "User",
    light: isArabic ? "الوضع الفاتح" : "Light Mode",
    dark: isArabic ? "الوضع الداكن" : "Dark Mode",
    language: isArabic ? "اللغة" : "Language",
  };

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const [meResponse, statsResponse, usersResponse, sourcesResponse, activityResponse] = await Promise.all([
        fetch("http://localhost:8000/auth/me", { credentials: "include" }),
        fetch("http://localhost:8000/auth/admin/stats", { credentials: "include" }),
        fetch("http://localhost:8000/auth/admin/users", { credentials: "include" }),
        fetch("http://localhost:8000/auth/admin/sources", { credentials: "include" }),
        fetch("http://localhost:8000/auth/admin/activity", { credentials: "include" }),
      ]);

      if (meResponse.status === 401) {
        window.location.href = "/";
        return;
      }
      if (statsResponse.status === 403 || usersResponse.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (!meResponse.ok || !statsResponse.ok || !usersResponse.ok || !sourcesResponse.ok || !activityResponse.ok) {
        throw new Error("request failed");
      }

      const meData = await meResponse.json();
      const statsData = await statsResponse.json();
      const usersData = await usersResponse.json();
      const sourcesData = await sourcesResponse.json();
      const activityData = await activityResponse.json();
      setAdmin(meData.user);
      setStats(statsData);
      setUsers(usersData.users);
      setSources(sourcesData.sources);
      setActivity(activityData.activity);
    } catch {
      setError(t.backendError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeStatus(user: ManagedUser) {
    setUpdatingId(user.id);
    setError("");
    try {
      const response = await fetch(`http://localhost:8000/auth/admin/users/${user.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || t.updateError);
        return;
      }
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, is_active: data.is_active } : item));
      setStats((current) => current ? {
        ...current,
        active_users: current.active_users + (data.is_active ? 1 : -1),
        suspended_users: current.suspended_users + (data.is_active ? -1 : 1),
      } : current);
    } catch {
      setError(t.connectionError);
    } finally {
      setUpdatingId(null);
    }
  }

  async function addSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddingSource(true);
    setError("");
    try {
      const response = await fetch("http://localhost:8000/auth/admin/sources", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: sourceLabel, account: sourceAccount }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || t.addSourceError);
        return;
      }
      setSources((current) => [...current, data.source]);
      setSourceLabel("");
      setSourceAccount("");
    } catch {
      setError(t.connectionError);
    } finally {
      setAddingSource(false);
    }
  }

  async function toggleSource(source: TrustedSource) {
    setUpdatingId(source.id);
    setError("");
    try {
      const response = await fetch(`http://localhost:8000/auth/admin/sources/${source.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !source.is_active }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || t.sourceUpdateError);
        return;
      }
      setSources((current) => current.map((item) => item.id === source.id ? { ...item, is_active: data.is_active } : item));
    } catch {
      setError(t.connectionError);
    } finally {
      setUpdatingId(null);
    }
  }

  async function logout() {
    await fetch("http://localhost:8000/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  }

  const palette = darkMode
    ? {
        page: "#0B1220", card: "#111C2E", border: "#293A53", text: "#E5EDF8",
        heading: "#F1F5F9", muted: "#9FB0C6", tableHead: "#17263D",
        rowBorder: "#23344B", input: "#0B1628", sourceCard: "#142238",
        button: "#1E3A5F", buttonText: "#DBEAFE", link: "#60A5FA",
      }
    : {
        page: "#F4F7FB", card: "#FFFFFF", border: "#E2E8F0", text: "#1E293B",
        heading: "#14213D", muted: "#64748B", tableHead: "#F8FAFC",
        rowBorder: "#EEF2F7", input: "#FFFFFF", sourceCard: "#F8FAFC",
        button: "#FFFFFF", buttonText: "#334155", link: "#2563EB",
      };

  const cardStyle: React.CSSProperties = {
    background: palette.card,
    border: `1px solid ${palette.border}`,
    borderRadius: 16,
    padding: 20,
    boxShadow: darkMode ? "0 6px 18px rgba(0,0,0,.18)" : "0 6px 18px rgba(15,23,42,.06)",
    color: palette.text,
  };

  const buttonStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    background: palette.button,
    color: palette.buttonText,
    fontWeight: 700,
    cursor: "pointer",
  };

  const controlGroup: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: 4,
    border: `1px solid ${palette.border}`,
    borderRadius: 999,
    background: darkMode ? "#17263D" : "#F1F5F9",
  };

  if (accessDenied) {
    return (
      <main dir={isArabic ? "rtl" : "ltr"} style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: palette.page, padding: 20, fontFamily: "Arial, sans-serif" }}>
        <section style={{ ...cardStyle, maxWidth: 520, textAlign: "center", padding: 40 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            <button onClick={() => changeLanguage("ar")} style={buttonStyle}>AR</button>
            <button onClick={() => changeLanguage("en")} style={buttonStyle}>EN</button>
            <button onClick={() => changeTheme(false)} style={buttonStyle}>☀️</button>
            <button onClick={() => changeTheme(true)} style={buttonStyle}>🌙</button>
          </div>
          <h1 style={{ color: "#B91C1C" }}>{t.accessTitle}</h1>
          <p style={{ color: palette.muted, lineHeight: 1.8 }}>{t.accessDescription}</p>
          <Link href="/" style={{ color: palette.link, fontWeight: 800 }}>{t.backHome}</Link>
        </section>
      </main>
    );
  }

  return (
    <main dir={isArabic ? "rtl" : "ltr"} style={{ minHeight: "100vh", padding: "28px 20px 60px", background: palette.page, color: palette.text, fontFamily: "Arial, sans-serif", transition: "background .2s,color .2s" }}>
      <header style={{ maxWidth: 1150, margin: "0 auto 28px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" width={58} height={58} alt="FactRoot logo" />
          <div>
            <strong style={{ display: "block", fontSize: 25, color: palette.heading }}>Fact<span style={{ color: "#2563EB" }}>Root</span></strong>
            <span style={{ color: "#7C3AED", fontSize: 13, fontWeight: 700 }}>{t.dashboard}</span>
        </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div role="group" aria-label={t.language} style={controlGroup}>
            <button type="button" onClick={() => changeLanguage("ar")} aria-pressed={isArabic} style={{ ...buttonStyle, border: isArabic ? "1px solid #477AFF" : `1px solid ${palette.border}`, background: isArabic ? (darkMode ? "#1C3154" : "#FFFFFF") : "transparent", color: isArabic ? "#4F7CFF" : palette.muted }}>AR</button>
            <button type="button" onClick={() => changeLanguage("en")} aria-pressed={!isArabic} style={{ ...buttonStyle, border: !isArabic ? "1px solid #477AFF" : `1px solid ${palette.border}`, background: !isArabic ? "linear-gradient(135deg,#2563EB,#4F7CFF)" : "transparent", color: !isArabic ? "#FFFFFF" : palette.muted }}>EN</button>
          </div>
          <div role="group" aria-label="Theme" style={controlGroup}>
            <button type="button" onClick={() => changeTheme(true)} aria-pressed={darkMode} title={t.dark} style={{ ...buttonStyle, background: darkMode ? "linear-gradient(135deg,#2563EB,#4F7CFF)" : "transparent", color: darkMode ? "#FFFFFF" : palette.muted, border: "none" }}>🌙</button>
            <button type="button" onClick={() => changeTheme(false)} aria-pressed={!darkMode} title={t.light} style={{ ...buttonStyle, background: !darkMode ? "#FFFFFF" : "transparent", color: !darkMode ? "#2563EB" : palette.muted, border: "none" }}>☀️</button>
          </div>
          {admin && <span style={{ color: palette.muted }}>{t.welcome} {admin.name}</span>}
          <Link href="/" style={{ color: palette.link, textDecoration: "none", fontWeight: 700 }}>{t.site}</Link>
          <button onClick={logout} style={{ ...buttonStyle, border: "1px solid #FCA5A5", color: "#DC2626" }}>{t.logout}</button>
        </div>
      </header>

      <div style={{ maxWidth: 1150, margin: "0 auto" }}>
        <section style={{ marginBottom: 28 }}>
          <h1 style={{ margin: "0 0 6px", color: palette.heading, fontSize: 30 }}>{t.overview}</h1>
          <p style={{ margin: 0, color: palette.muted }}>{t.overviewDescription}</p>
        </section>

        {loading && <div role="status" aria-live="polite" style={{ textAlign: "center", padding: 45, color: palette.muted }}>{t.loading}</div>}
        {error && <div role="alert" style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: darkMode ? "#3B1C27" : "#FEF2F2", color: darkMode ? "#FCA5A5" : "#B91C1C", textAlign: "center" }}>{error}</div>}

        {stats && (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 28 }}>
            {[
              [t.users, stats.users, "#2563EB"],
              [t.activeUsers, stats.active_users, "#16A34A"],
              [t.suspendedUsers, stats.suspended_users, "#DC2626"],
              [t.checks, stats.checks, "#7C3AED"],
            ].map(([label, value, color]) => (
              <div key={String(label)} style={cardStyle}>
                <span style={{ color: palette.muted, fontWeight: 700 }}>{label}</span>
                <strong style={{ display: "block", marginTop: 10, color: String(color), fontSize: 31 }}>{value}</strong>
              </div>
            ))}
          </section>
        )}

        {!loading && (
          <section style={{ ...cardStyle, overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "20px 22px", borderBottom: `1px solid ${palette.border}` }}>
              <h2 style={{ margin: 0, color: palette.heading, fontSize: 22 }}>{t.manageUsers}</h2>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <caption className="factroot-visually-hidden">{t.manageUsers}</caption>
                <thead style={{ background: palette.tableHead }}>
                  <tr>
                    {[t.name, t.email, t.role, t.registered, t.status, t.action].map((heading) => (
                      <th scope="col" key={heading} style={{ padding: 14, textAlign: isArabic ? "right" : "left", color: palette.muted, fontSize: 14 }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} style={{ borderTop: `1px solid ${palette.rowBorder}` }}>
                      <td style={{ padding: 14, color: palette.text, fontWeight: 700 }}>{user.name}</td>
                      <td style={{ padding: 14, color: palette.muted }}>{user.email}</td>
                      <td style={{ padding: 14, color: user.role === "admin" ? "#7C3AED" : palette.text, fontWeight: 700 }}>{user.role === "admin" ? t.admin : t.user}</td>
                      <td style={{ padding: 14, color: palette.muted }}>{new Date(user.created_at * 1000).toLocaleDateString(isArabic ? "ar-SA" : "en-US")}</td>
                      <td style={{ padding: 14 }}>
                        <span style={{ display: "inline-block", padding: "5px 9px", borderRadius: 999, background: user.is_active ? (darkMode ? "#153B2A" : "#DCFCE7") : (darkMode ? "#431F2A" : "#FEE2E2"), color: user.is_active ? (darkMode ? "#86EFAC" : "#166534") : (darkMode ? "#FCA5A5" : "#991B1B"), fontSize: 13, fontWeight: 700 }}>
                          {user.is_active ? t.active : t.suspended}
                        </span>
                      </td>
                      <td style={{ padding: 14 }}>
                        {user.role === "user" ? (
                          <button type="button" onClick={() => changeStatus(user)} disabled={updatingId === user.id} aria-label={`${user.is_active ? t.deactivate : t.activate} ${user.name}`} style={{ padding: "7px 11px", border: `1px solid ${user.is_active ? "#FCA5A5" : "#86EFAC"}`, borderRadius: 8, background: palette.button, color: user.is_active ? "#DC2626" : "#16A34A", fontWeight: 700, cursor: updatingId === user.id ? "wait" : "pointer" }}>
                            {updatingId === user.id ? t.activating : user.is_active ? t.deactivate : t.activate}
                          </button>
                        ) : <span style={{ color: palette.muted }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!loading && (
          <section style={{ ...cardStyle, marginTop: 28 }}>
            <h2 style={{ margin: "0 0 6px", color: palette.heading, fontSize: 22 }}>{t.sources}</h2>
            <p style={{ margin: "0 0 20px", color: palette.muted }}>{t.sourcesDescription}</p>
            <form onSubmit={addSource} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) minmax(180px,1fr) auto", gap: 10, marginBottom: 20 }}>
              <input aria-label={t.sourceName} value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} required placeholder={t.sourceName} style={{ padding: 12, border: `1px solid ${palette.border}`, borderRadius: 10, fontSize: 15, background: palette.input, color: palette.text }} />
              <input aria-label={t.sourceAccount} value={sourceAccount} onChange={(event) => setSourceAccount(event.target.value)} required placeholder={t.sourceAccount} dir="ltr" style={{ padding: 12, border: `1px solid ${palette.border}`, borderRadius: 10, fontSize: 15, background: palette.input, color: palette.text }} />
              <button type="submit" disabled={addingSource} style={{ padding: "10px 18px", border: 0, borderRadius: 10, background: "#2563EB", color: "#FFFFFF", fontWeight: 800, cursor: addingSource ? "wait" : "pointer" }}>{addingSource ? t.adding : t.addSource}</button>
            </form>
            <div style={{ display: "grid", gap: 10 }}>
              {sources.map((source) => (
                <div key={source.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: 14, border: `1px solid ${palette.border}`, borderRadius: 12, background: palette.sourceCard }}>
                  <div>
                    <strong style={{ display: "block", color: palette.text, marginBottom: 4 }}>{source.label}</strong>
                    <span dir="ltr" style={{ color: palette.link }}>@{source.account}</span>
                  </div>
                  <button type="button" onClick={() => toggleSource(source)} disabled={updatingId === source.id} aria-label={`${source.is_active ? t.deactivateSource : t.activateSource} ${source.label}`} style={{ padding: "7px 12px", border: `1px solid ${source.is_active ? "#FCA5A5" : "#86EFAC"}`, borderRadius: 8, background: palette.button, color: source.is_active ? "#DC2626" : "#16A34A", fontWeight: 700, cursor: "pointer" }}>
                    {source.is_active ? t.deactivateSource : t.activateSource}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && (
          <section style={{ ...cardStyle, marginTop: 28 }}>
            <h2 style={{ margin: "0 0 6px", color: palette.heading, fontSize: 22 }}>{t.recentActivity}</h2>
            <p style={{ margin: "0 0 20px", color: palette.muted }}>{t.activityDescription}</p>
            {activity.length === 0 ? (
              <div style={{ padding: 25, textAlign: "center", color: palette.muted }}>{t.noActivity}</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
                  <caption className="factroot-visually-hidden">{t.recentActivity}</caption>
                  <thead style={{ background: palette.tableHead }}>
                    <tr>
                      {[t.actor, t.result, t.bestMatch, t.date].map((heading) => (
                        <th scope="col" key={heading} style={{ padding: 12, textAlign: isArabic ? "right" : "left", color: palette.muted }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((item) => (
                      <tr key={item.id} style={{ borderTop: `1px solid ${palette.border}` }}>
                        <td style={{ padding: 12, color: palette.text }}>{item.actor_type === "guest" ? t.guest : item.actor_name || t.unnamedUser}</td>
                        <td style={{ padding: 12, color: palette.text }}>{item.status}</td>
                        <td style={{ padding: 12, color: palette.link, fontWeight: 700 }}>{item.match_score === null ? "—" : `${item.match_score}%`}</td>
                        <td style={{ padding: 12, color: palette.muted }}>{new Date(item.created_at * 1000).toLocaleString(isArabic ? "ar-SA" : "en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
