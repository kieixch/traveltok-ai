"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert, Button, Input, Label } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setSent(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Cek email kamu" subtitle="Kami mengirimkan tautan reset password.">
        <Alert kind="success">
          Jika email <strong>{email}</strong> terdaftar, tautan untuk memilih password baru sudah
          dikirim. Tautan ini berlaku 1 jam.
        </Alert>
        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/login" className="font-medium text-emerald-500 dark:text-emerald-400 hover:underline">
            Kembali ke halaman masuk
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Lupa password" subtitle="Masukkan alamat email untuk menerima tautan reset.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        <Button type="submit" className="w-full" loading={loading}>
          Kirim tautan reset
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-emerald-500 dark:text-emerald-400 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}