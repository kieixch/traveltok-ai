"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  clearSession,
  getStoredUser,
  getToken,
  type StoredUser,
} from "@/lib/auth";
import {
  AnalyticsIcon,
  ChevronDownIcon,
  CreatorsIcon,
  DashboardIcon,
  IdeasIcon,
  Logo,
  LogOutIcon,
  MapPinIcon,
  MoreIcon,
  PlansIcon,
  SearchIcon,
  TrendsIcon,
  VideoIcon,
} from "./icons";
import { AiEngineSelect } from "./AiEngineSelect";
import { ThemeToggle } from "./ThemeToggle";
import { ScrapingNotification } from "./ScrapingNotification";

const NAV = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/analytics", label: "Analytics", icon: AnalyticsIcon },
  { href: "/creators", label: "Creators", icon: CreatorsIcon },
  { href: "/videos", label: "Videos", icon: VideoIcon },
  { href: "/ideas", label: "Ideas", icon: IdeasIcon },
  { href: "/plans", label: "Plans", icon: PlansIcon },
  { href: "/trends", label: "Trends", icon: TrendsIcon },
  { href: "/search", label: "Search", icon: SearchIcon },
];

const MOBILE_PRIMARY = ["/", "/videos", "/analytics", "/creators", "/ideas"];
const MOBILE_MORE = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href));

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean>(() => Boolean(getToken()));
  const [user, setUser] = useState<StoredUser | null>(() => getStoredUser());
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    const refresh = () => {
      setAuthed(Boolean(getToken()));
      setUser(getStoredUser());
    };
    window.addEventListener("traveltok:auth", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("traveltok:auth", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const signOut = () => {
    clearSession();
    setAuthed(false);
    setUser(null);
    setMenuOpen(false);
    router.push("/login");
  };

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="flex min-h-dvh">
      {/* Ambient background */}
      <div className="app-glow" />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 z-30 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.02] lg:flex">
        <div className="flex items-center gap-3 px-6 pb-6 pt-7">
          <Logo size={38} />
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              TravelTok <span className="text-gradient">AI</span>
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Creator Intelligence</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-400/20 dark:text-emerald-300"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-gradient-to-b from-emerald-400 to-cyan-400" />
                )}
                <item.icon style={{ width: 18, height: 18 }} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {authed && user && (
          <AiEngineSelect variant="sidebar" />
        )}

        {authed && user && (
          <div className="border-t border-slate-200 p-3 dark:border-white/10">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Avatar name={user.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
                <p className="truncate text-xs text-slate-400 dark:text-slate-500">{user.email}</p>
              </div>
              <ChevronDownIcon style={{ width: 16, height: 16 }} className="text-slate-400 dark:text-slate-500" />
            </button>
            {menuOpen && (
              <button
                onClick={signOut}
                className="mt-1 flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-400/10 dark:hover:text-red-300"
              >
                <LogOutIcon style={{ width: 16, height: 16 }} />
                Sign out
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#05070d]/70 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Logo size={32} />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              TravelTok <span className="text-gradient">AI</span>
            </span>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <MapPinIcon style={{ width: 16, height: 16 }} className="text-emerald-500 dark:text-emerald-400" />
            <span className="text-sm text-slate-500 dark:text-slate-400">Creator intelligence platform</span>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <div ref={menuRef}>
              {authed && user ? (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    <Avatar name={user.name} size={30} />
                    <span className="hidden text-sm font-medium text-slate-900 sm:block dark:text-slate-100">
                      {user.name}
                    </span>
                    <ChevronDownIcon style={{ width: 14, height: 14 }} className="text-slate-400 dark:text-slate-500" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 dark:border-white/10 dark:bg-[#0b1120] dark:shadow-black/50">
                      <AiEngineSelect variant="menu" />
                      <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
                        <p className="truncate text-xs text-slate-400 dark:text-slate-500">{user.email}</p>
                      </div>
                      <button
                        onClick={signOut}
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-400/10 dark:hover:text-red-300"
                      >
                        <LogOutIcon style={{ width: 16, height: 16 }} />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-white/10 dark:bg-[#05070d]/85 lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.href)).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { setMenuOpen(false); setMoreOpen(false); }}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] transition-colors ${
                  active ? "text-emerald-600 dark:text-emerald-300" : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
                }`}
              >
                <item.icon style={{ width: 20, height: 20 }} />
                {item.label}
              </Link>
            );
          })}
          <div ref={moreRef} className="relative">
            <button
              onClick={() => { setMoreOpen((o) => !o); setMenuOpen(false); }}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] transition-colors ${
                MOBILE_MORE.some((n) => isActive(pathname, n.href))
                  ? "text-emerald-600 dark:text-emerald-300"
                  : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
              }`}
            >
              <MoreIcon style={{ width: 20, height: 20 }} />
              More
            </button>
            {moreOpen && (
              <div className="absolute bottom-full left-1/2 z-50 mb-2 w-40 -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 dark:border-white/10 dark:bg-[#0b1120] dark:shadow-black/50">
                {MOBILE_MORE.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        active
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                          : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                      }`}
                    >
                      <item.icon style={{ width: 16, height: 16 }} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </nav>

      <ScrapingNotification />
    </div>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initial = (name?.trim().charAt(0) || "U").toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 font-semibold text-white shadow-lg shadow-emerald-500/25"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}
