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
      setError("تعذر تحميل لوحة الإدارة. تأكدي أن Backend يعمل.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function changeStatus(user: ManagedUser) {
    setUpdatingId(user.id);
    setError("");
    try {
      const response = await fetch(
        `http://localhost:8000/auth/admin/users/${user.id}/status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !user.is_active }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || "تعذر تحديث الحساب.");
        return;
      }
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, is_active: data.is_active } : item
        )
      );
      setStats((current) =>
        current
          ? {
              ...current,
              active_users: current.active_users + (data.is_active ? 1 : -1),
              suspended_users: current.suspended_users + (data.is_active ? -1 : 1),
            }
          : current
      );
    } catch {
      setError("تعذر الاتصال بالخادم.");
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
        setError(data.detail || "تعذر إضافة المصدر.");
        return;
      }
      setSources((current) => [...current, data.source]);
      setSourceLabel("");
      setSourceAccount("");
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setAddingSource(false);
    }
  }

  async function toggleSource(source: TrustedSource) {
    setUpdatingId(source.id);
    setError("");
    try {
      const response = await fetch(
        `http://localhost:8000/auth/admin/sources/${source.id}/status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !source.is_active }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || "تعذر تحديث المصدر.");
        return;
      }
      setSources((current) =>
        current.map((item) =>
          item.id === source.id ? { ...item, is_active: data.is_active } : item
        )
      );
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function logout() {
    await fetch("http://localhost:8000/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  }

  const cardStyle = {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 6px 18px rgba(15,23,42,.06)",
  };

  if (accessDenied) {
    return (
      <main dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F4F7FB", padding: 20, fontFamily: "Arial, sans-serif" }}>
        <section style={{ ...cardStyle, maxWidth: 520, textAlign: "center", padding: 40 }}>
          <h1 style={{ color: "#B91C1C" }}>ليس لديك صلاحية</h1>
          <p style={{ color: "#64748B", lineHeight: 1.8 }}>هذه الصفحة مخصصة لحساب المدير فقط.</p>
          <Link href="/" style={{ color: "#2563EB", fontWeight: 800 }}>العودة للرئيسية</Link>
        </section>
      </main>
    );
  }

  return (
    <main dir="rtl" style={{ minHeight: "100vh", padding: "28px 20px 60px", background: "#F4F7FB", fontFamily: "Arial, sans-serif" }}>
      <header style={{ maxWidth: 1150, margin: "0 auto 28px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" width={58} height={58} alt="شعار FactRoot" />
          <div>
            <strong style={{ display: "block", fontSize: 25, color: "#111827" }}>Fact<span style={{ color: "#2563EB" }}>Root</span></strong>
            <span style={{ color: "#7C3AED", fontSize: 13, fontWeight: 700 }}>لوحة الإدارة</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {admin && <span style={{ color: "#475569" }}>مرحبًا، {admin.name}</span>}
          <Link href="/" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 700 }}>الموقع</Link>
          <button onClick={logout} style={{ padding: "9px 14px", border: "1px solid #FCA5A5", borderRadius: 10, background: "#FFFFFF", color: "#DC2626", fontWeight: 700, cursor: "pointer" }}>تسجيل الخروج</button>
        </div>
      </header>

      <div style={{ maxWidth: 1150, margin: "0 auto" }}>
        <section style={{ marginBottom: 28 }}>
          <h1 style={{ margin: "0 0 6px", color: "#14213D", fontSize: 30 }}>نظرة عامة</h1>
          <p style={{ margin: 0, color: "#64748B" }}>إحصائيات المستخدمين وعمليات التحقق في FactRoot.</p>
        </section>

        {loading && <div style={{ textAlign: "center", padding: 45, color: "#64748B" }}>جاري تحميل لوحة الإدارة...</div>}
        {error && <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: "#FEF2F2", color: "#B91C1C", textAlign: "center" }}>{error}</div>}

        {stats && (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 28 }}>
            {[
              ["المستخدمون", stats.users, "#2563EB"],
              ["الحسابات النشطة", stats.active_users, "#16A34A"],
              ["الحسابات الموقوفة", stats.suspended_users, "#DC2626"],
              ["عمليات التحقق", stats.checks, "#7C3AED"],
            ].map(([label, value, color]) => (
              <div key={String(label)} style={cardStyle}>
                <span style={{ color: "#64748B", fontWeight: 700 }}>{label}</span>
                <strong style={{ display: "block", marginTop: 10, color: String(color), fontSize: 31 }}>{value}</strong>
              </div>
            ))}
          </section>
        )}

        {!loading && (
          <section style={{ ...cardStyle, overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "20px 22px", borderBottom: "1px solid #E2E8F0" }}>
              <h2 style={{ margin: 0, color: "#14213D", fontSize: 22 }}>إدارة المستخدمين</h2>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead style={{ background: "#F8FAFC" }}>
                  <tr>
                    {['الاسم', 'البريد الإلكتروني', 'النوع', 'تاريخ التسجيل', 'الحالة', 'الإجراء'].map((heading) => (
                      <th key={heading} style={{ padding: 14, textAlign: "right", color: "#475569", fontSize: 14 }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} style={{ borderTop: "1px solid #EEF2F7" }}>
                      <td style={{ padding: 14, color: "#1E293B", fontWeight: 700 }}>{user.name}</td>
                      <td style={{ padding: 14, color: "#475569" }}>{user.email}</td>
                      <td style={{ padding: 14, color: user.role === "admin" ? "#7C3AED" : "#475569", fontWeight: 700 }}>{user.role === "admin" ? "مدير" : "مستخدم"}</td>
                      <td style={{ padding: 14, color: "#64748B" }}>{new Date(user.created_at * 1000).toLocaleDateString("ar-SA")}</td>
                      <td style={{ padding: 14 }}>
                        <span style={{ display: "inline-block", padding: "5px 9px", borderRadius: 999, background: user.is_active ? "#DCFCE7" : "#FEE2E2", color: user.is_active ? "#166534" : "#991B1B", fontSize: 13, fontWeight: 700 }}>
                          {user.is_active ? "نشط" : "موقوف"}
                        </span>
                      </td>
                      <td style={{ padding: 14 }}>
                        {user.role === "user" ? (
                          <button
                            onClick={() => changeStatus(user)}
                            disabled={updatingId === user.id}
                            style={{ padding: "7px 11px", border: `1px solid ${user.is_active ? "#FCA5A5" : "#86EFAC"}`, borderRadius: 8, background: "#FFFFFF", color: user.is_active ? "#DC2626" : "#16A34A", fontWeight: 700, cursor: updatingId === user.id ? "wait" : "pointer" }}
                          >
                            {updatingId === user.id ? "جاري..." : user.is_active ? "إيقاف" : "تفعيل"}
                          </button>
                        ) : (
                          <span style={{ color: "#94A3B8" }}>—</span>
                        )}
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
            <h2 style={{ margin: "0 0 6px", color: "#14213D", fontSize: 22 }}>المصادر الموثوقة</h2>
            <p style={{ margin: "0 0 20px", color: "#64748B" }}>حسابات X الرسمية التي يستخدمها الموقع للتحقق.</p>

            <form onSubmit={addSource} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) minmax(180px,1fr) auto", gap: 10, marginBottom: 20 }}>
              <input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} required placeholder="اسم الجهة" style={{ padding: 12, border: "1px solid #CBD5E1", borderRadius: 10, fontSize: 15 }} />
              <input value={sourceAccount} onChange={(event) => setSourceAccount(event.target.value)} required placeholder="حساب X مثل DgaGovSa" dir="ltr" style={{ padding: 12, border: "1px solid #CBD5E1", borderRadius: 10, fontSize: 15 }} />
              <button disabled={addingSource} style={{ padding: "10px 18px", border: 0, borderRadius: 10, background: "#2563EB", color: "#FFFFFF", fontWeight: 800, cursor: addingSource ? "wait" : "pointer" }}>
                {addingSource ? "جاري..." : "إضافة مصدر"}
              </button>
            </form>

            <div style={{ display: "grid", gap: 10 }}>
              {sources.map((source) => (
                <div key={source.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: 14, border: "1px solid #E2E8F0", borderRadius: 12, background: "#F8FAFC" }}>
                  <div>
                    <strong style={{ display: "block", color: "#1E293B", marginBottom: 4 }}>{source.label}</strong>
                    <span dir="ltr" style={{ color: "#2563EB" }}>@{source.account}</span>
                  </div>
                  <button
                    onClick={() => toggleSource(source)}
                    disabled={updatingId === source.id}
                    style={{ padding: "7px 12px", border: `1px solid ${source.is_active ? "#FCA5A5" : "#86EFAC"}`, borderRadius: 8, background: "#FFFFFF", color: source.is_active ? "#DC2626" : "#16A34A", fontWeight: 700, cursor: "pointer" }}
                  >
                    {source.is_active ? "تعطيل" : "تفعيل"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && (
          <section style={{ ...cardStyle, marginTop: 28 }}>
            <h2 style={{ margin: "0 0 6px", color: "#14213D", fontSize: 22 }}>نشاط التحقق الأخير</h2>
            <p style={{ margin: "0 0 20px", color: "#64748B" }}>نعرض نوع المستخدم والنتيجة فقط، من دون نص الخبر حفاظًا على الخصوصية.</p>
            {activity.length === 0 ? (
              <div style={{ padding: 25, textAlign: "center", color: "#64748B" }}>لا يوجد نشاط حتى الآن.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
                  <thead style={{ background: "#F8FAFC" }}>
                    <tr>
                      {['المنفذ', 'النتيجة', 'أفضل تطابق', 'التاريخ'].map((heading) => (
                        <th key={heading} style={{ padding: 12, textAlign: "right", color: "#475569" }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((item) => (
                      <tr key={item.id} style={{ borderTop: "1px solid #E2E8F0" }}>
                        <td style={{ padding: 12, color: "#334155" }}>{item.actor_type === "guest" ? "زائر" : item.actor_name || "مستخدم"}</td>
                        <td style={{ padding: 12, color: "#334155" }}>{item.status}</td>
                        <td style={{ padding: 12, color: "#2563EB", fontWeight: 700 }}>{item.match_score === null ? "—" : `${item.match_score}%`}</td>
                        <td style={{ padding: 12, color: "#64748B" }}>{new Date(item.created_at * 1000).toLocaleString("ar-SA")}</td>
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
