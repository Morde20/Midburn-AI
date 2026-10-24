"use client";

/**
 * app/admin/users/page.tsx
 *
 * Admin-only page (enforced by middleware.ts's "/admin" prefix rule) to
 * list existing user/admin accounts and create new ones. Talks to the
 * existing app/api/admin/users/route.ts (GET list, POST create) — no new
 * backend needed.
 *
 * Note: the DB enum value stays "volunteer"; only the on-screen label is
 * "משתמש/ת" / "User".
 */

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type Role = "admin" | "volunteer";
type UserRow = { id: string; username: string; role: Role; createdAt: string };

const inputCls =
  "w-full bg-ctl-night border border-ctl-line rounded-xl px-3.5 py-2.5 text-sm text-ctl-text placeholder:text-ctl-muted focus:outline-none focus:border-ctl-amber";

export default function AdminUsersPage() {
  const { t, dir, locale } = useLanguage();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("volunteer");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      setUsers(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function onDelete(id: string) {
    if (!confirm(t.admin.users.deleteConfirm)) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    loadUsers();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    });

    setSubmitting(false);

    if (res.ok) {
      setMessage({ kind: "ok", text: t.admin.users.created });
      setUsername("");
      setPassword("");
      setRole("volunteer");
      loadUsers();
    } else {
      const body = await res.json().catch(() => null);
      setMessage({
        kind: "err",
        text: body?.error ? JSON.stringify(body.error) : t.admin.users.error,
      });
    }
  }

  return (
    <main className="flex flex-col h-dvh bg-ctl-night">
      <Header />
      <div dir={dir} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl w-full mx-auto space-y-5">
          <h1 className="text-xl font-semibold text-ctl-text">{t.admin.users.title}</h1>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
            {/* Existing users (first in DOM = start side) */}
            <section className="bg-ctl-panel border border-ctl-line rounded-2xl overflow-hidden">
              <h2 className="px-5 py-3.5 text-sm font-medium text-ctl-muted border-b border-ctl-line">
                {t.admin.users.existing}
              </h2>
              {loading ? (
                <p className="px-5 py-4 text-sm text-ctl-muted">…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-ctl-muted text-start">
                        <th className="px-5 py-2.5 font-medium text-start">{t.admin.users.username}</th>
                        <th className="px-3 py-2.5 font-medium text-start">{t.admin.users.role}</th>
                        <th className="px-3 py-2.5 font-medium text-start">{t.admin.users.createdAt}</th>
                        <th className="px-5 py-2.5 font-medium text-start">{t.admin.users.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-t border-ctl-line">
                          <td className="px-5 py-3 text-ctl-text">{u.username}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full border ${
                                u.role === "admin"
                                  ? "border-ctl-amber/50 text-ctl-amber"
                                  : "border-ctl-line text-ctl-muted"
                              }`}
                            >
                              {u.role === "admin"
                                ? t.admin.users.roleAdmin
                                : t.admin.users.roleVolunteer}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-ctl-muted whitespace-nowrap">
                            {new Date(u.createdAt).toLocaleDateString(
                              locale === "he" ? "he-IL" : "en-US"
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {u.role === "volunteer" && (
                              <button
                                onClick={() => onDelete(u.id)}
                                className="text-xs text-ctl-bad hover:underline"
                              >
                                {t.admin.users.delete}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Create form */}
            <form
              onSubmit={onSubmit}
              className="bg-ctl-panel border border-ctl-line rounded-2xl p-5 space-y-3"
            >
              <h2 className="text-sm font-medium text-ctl-muted mb-1">{t.admin.users.newUser}</h2>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.admin.users.username}
                required
                minLength={3}
                className={inputCls}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.admin.users.password}
                required
                minLength={8}
                className={inputCls}
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={inputCls}
              >
                <option value="volunteer">{t.admin.users.roleVolunteer}</option>
                <option value="admin">{t.admin.users.roleAdmin}</option>
              </select>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-ctl-amber text-ctl-night font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-110"
              >
                {submitting ? t.admin.users.creating : t.admin.users.create}
              </button>
              {message && (
                <p className={`text-xs ${message.kind === "ok" ? "text-ctl-ok" : "text-ctl-bad"}`}>
                  {message.text}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
