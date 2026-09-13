"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { setSession } from "@/lib/auth";
import type { AuthResponse } from "@/lib/types";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert, Button, Input, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setUnverified(false);
    setLoading(true);
    try {
      const data = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setSession(data.token, data.user);
      router.push("/");
    } catch (err) {
      setUnverified(err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED");
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setNotice(null);
    try {
      await api<{ message: string }>("/auth/resend-verification", {
        method: "POST",
        body: { email },
      });
      setNotice("Tautan verifikasi telah dikirim ulang. Cek inbox kamu.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your creator workspace.">
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
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-emerald-500 dark:text-emerald-400 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {error && <Alert kind="error">{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}

        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>

      {unverified && (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-50 p-4 dark:bg-amber-400/10">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Verifikasi email kamu dulu sebelum masuk.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3 w-full"
            onClick={() => void resend()}
            loading={resending}
          >
            Kirim ulang tautan verifikasi
          </Button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        No account?{" "}
        <Link href="/register" className="font-medium text-emerald-500 dark:text-emerald-400 hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}