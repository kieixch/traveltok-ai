import type { ReactNode } from "react";
import { Logo } from "./icons";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="app-glow" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size={56} />
          <div className="text-center">
            <p className="text-lg font-semibold tracking-tight text-slate-50">
              TravelTok <span className="text-gradient">AI</span>
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Analytics &amp; content planning for travel creators.
            </p>
          </div>
        </div>

        <div className="glass rounded-3xl border border-white/10 p-8 shadow-2xl shadow-black/40">
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
