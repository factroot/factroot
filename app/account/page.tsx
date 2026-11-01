"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthUser } from "../components/AuthModal";

type HistoryItem = {
  id: number;
  news: string;
  status: string;
  best_match: { account?: string; match_score?: number } | null;
  created_at: number;
};

export default function AccountPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:8000/auth/me", { credentials: "include" }),
      fetch("http://localhost:8000/auth/history", { credentials: "include" }),
    ])
      .then(async ([userResponse, historyResponse]) => {
        if (userResponse.status === 401 || historyResponse.status === 401) {
          window.location.href = "/";
          return;
        }
        if (!userResponse.ok || !historyResponse.ok) {
          throw new Error("request failed");
        }
        const userData = await userResponse.json();
        const historyData = await historyResponse.json();
        setUser(userData.user);
        setHistory(historyData.history);
      })
      .catch(() => setError("تعذر تحميل سجل التحققات."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        padding: "32px 20px 70px",
        background: "linear-gradient(180deg,#F8FBFF 0%,#EEF4FB 100%)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          maxWidth: 1000,
          margin: "0 auto 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" width={58} height={58} alt="شعار FactRoot" />
          <strong style={{ fontSize: 27, color: "#111827" }}>Fact<span style={{ color: "#2563EB" }}>Root</span></strong>
        </div>
        <Link href="/" style={{ color: "#2563EB", fontWeight: 800, textDecoration: "none" }}>
          العودة للرئيسية ←
        </Link>
      </header>

      <section style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ background: "#FFFFFF", borderRadius: 18, padding: "26px 30px", boxShadow: "0 8px 24px rgba(15,23,42,.08)", marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 8px", color: "#14213D", fontSize: 29 }}>السجل</h1>
          {user && <p style={{ margin: 0, color: "#64748B" }}>مرحبًا {user.name}، هنا آخر الأخبار التي تحققتِ منها.</p>}
        </div>

        {loading && <div style={{ textAlign: "center", color: "#64748B", padding: 40 }}>جاري تحميل السجل...</div>}
        {error && <div style={{ padding: 18, borderRadius: 12, background: "#FEF2F2", color: "#B91C1C", textAlign: "center" }}>{error}</div>}
        {!loading && !error && history.length === 0 && (
          <div style={{ padding: 45, borderRadius: 18, background: "#FFFFFF", color: "#64748B", textAlign: "center", boxShadow: "0 8px 24px rgba(15,23,42,.06)" }}>
            لا توجد عمليات تحقق محفوظة حتى الآن.
          </div>
        )}

        <div style={{ display: "grid", gap: 16 }}>
          {history.map((item) => (
            <article key={item.id} style={{ padding: 22, borderRadius: 16, background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 5px 16px rgba(15,23,42,.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 15, flexWrap: "wrap", marginBottom: 12 }}>
                <strong style={{ color: "#1E3A8A" }}>{item.status}</strong>
                <time style={{ color: "#64748B", fontSize: 13 }}>
                  {new Date(item.created_at * 1000).toLocaleString("ar-SA")}
                </time>
              </div>
              <p style={{ margin: "0 0 12px", color: "#334155", lineHeight: 1.9 }}>{item.news}</p>
              {item.best_match && (
                <div style={{ paddingTop: 12, borderTop: "1px solid #EEF2F7", color: "#2563EB", fontWeight: 700 }}>
                  أفضل تطابق: {item.best_match.account} — {item.best_match.match_score}%
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
