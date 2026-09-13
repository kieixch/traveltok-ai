"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert, Button, Input, Label } from "@/components/ui";

export default function ResetPasswordPage() {
  const [token] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Link reset tidak valid.");
      return;
    }
    if (password !== confirm) {
      setError("Password tidak cocok.");
      return;
    }
    setLoading(true);
    try {
      await api<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
      setSuccess(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Link tidak valid" subtitle="Tautan reset password tidak ditemukan atau sudah kedaluwarsa.">
        <p className="text-sm text-slate-400">
          Silakan minta link reset password baru melalui halaman{" "}
          <Link href="/forgot-password" className="font-medium text-emerald-500 dark:text-emerald-400 hover:underline">
            Lupa password
          </Link>.
        </p>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout title="Password berhasil diubah" subtitle="Silakan masuk dengan password baru.">
        <Alert kind="success">Password kamu sudah diperbarui.</Alert>
        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/login" className="font-medium text-emerald-500 dark:text-emerald-400 hover:underline">
            Masuk
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Pilih password baru" subtitle="Masukkan password baru kamu.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="password">Password baru</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8+ chars, with a letter and a number"
          />
        </div>
        <div>
          <Label htmlFor="confirm">Ulangi password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        <Button type="submit" className="w-full" loading={loading}>
          Ubah password
        </Button>
      </form>
    </AuthLayout>
  );
}