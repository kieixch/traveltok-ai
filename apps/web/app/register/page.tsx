"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { AuthLayout } from "@/components/AuthLayout";
import { EmailDeliveryAlert } from "@/components/EmailDeliveryAlert";
import { Alert, Button, Input, Label } from "@/components/ui";

interface RegisterResponse {
  requiresVerification: boolean;
  message: string;
  emailSent?: boolean;
  devVerificationLink?: string;
}

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<RegisterResponse | null>(null);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeLink, setNoticeLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const data = await api<RegisterResponse>("/auth/register", {
        method: "POST",
        body: { name, email, password },
      });
      setSent(data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setNotice(null);
    setNoticeLink(null);
    try {
      const data = await api<{ message: string; devVerificationLink?: string }>(
        "/auth/resend-verification",
        { method: "POST", body: { email } },
      );
      setNotice(data.message);
      setNoticeLink(data.devVerificationLink ?? null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setResending(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout
        title="Cek email kamu"
        subtitle="Satu langkah lagi untuk mengaktifkan akun."
      >
        {sent.emailSent ? (
          <Alert kind="success">
            Kami mengirim tautan verifikasi ke <strong>{email}</strong>. Akun baru aktif
            setelah kamu mengonfirmasi alamat email yang asli.
          </Alert>
        ) : (
          <EmailDeliveryAlert
            link={sent.devVerificationLink}
            label="Buka link verifikasi sekarang"
          />
        )}
        <div className="mt-5 space-y-3">
          <Button className="w-full" onClick={() => void resend()} loading={resending}>
            Kirim ulang tautan
          </Button>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Sudah terverifikasi?{" "}
            <Link href="/login" className="font-medium text-emerald-500 dark:text-emerald-400 hover:underline">
              Masuk
            </Link>
          </p>
        </div>
        {!sent.emailSent && notice && <div className="mt-3">{notice}</div>}
        {noticeLink && (
          <div className="mt-3">
            <EmailDeliveryAlert
              link={noticeLink}
              label="Buka link verifikasi baru"
              message={notice ?? undefined}
            />
          </div>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Get insights, ideas and plans in minutes.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
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
        <div>
          <Label htmlFor="password">Password</Label>
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

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Kamu harus verifikasi email sebagai langkah pembuatan akun. Akun tanpa email asli
          tidak akan aktif dan tidak bisa login.
        </p>

        {error && <Alert kind="error">{error}</Alert>}

        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-emerald-500 dark:text-emerald-400 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}