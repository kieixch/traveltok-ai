"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert, Button, Spinner } from "@/components/ui";

export default function VerifyEmailPage() {
  const [token] = useState(() =>
    new URLSearchParams(window.location.search).get("token") ?? "",
  );
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!token) {
        setStatus("error");
        setError("Tautan verifikasi tidak ditemukan.");
        return;
      }
      try {
        await api<{ message: string }>("/auth/verify-email", {
          method: "POST",
          body: { token },
        });
        if (mounted) setStatus("ok");
      } catch (err) {
        if (mounted) {
          setStatus("error");
          setError(friendlyError(err));
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (status === "loading") {
    return (
      <AuthLayout title="Memverifikasi email" subtitle="Sebentar…">
        <div className="flex justify-center py-4 text-emerald-400">
          <Spinner className="h-6 w-6" />
        </div>
      </AuthLayout>
    );
  }

  if (status === "ok") {
    return (
      <AuthLayout title="Email terverifikasi" subtitle="Akun kamu sekarang aktif.">
        <Alert kind="success">
          Alamat email sudah dikonfirmasi. Kamu bisa masuk sekarang.
        </Alert>
        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/login" className="font-medium text-emerald-500 dark:text-emerald-400 hover:underline">
            Masuk →
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Verifikasi gagal" subtitle="Tidak bisa memverifikasi email.">
      <Alert kind="error">{error ?? "Terjadi kesalahan."}</Alert>
      <div className="mt-5 space-y-3">
        {token && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setStatus("loading")}
          >
            Coba lagi
          </Button>
        )}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/forgot-password" className="font-medium text-emerald-500 dark:text-emerald-400 hover:underline">
            Minta link verifikasi baru
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}