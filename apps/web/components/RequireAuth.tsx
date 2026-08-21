"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { getToken } from "@/lib/auth";
import { Spinner } from "./ui";

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const id = window.setTimeout(() => setChecked(true), 0);
    return () => window.clearTimeout(id);
  }, [router]);

  if (!checked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return <>{children}</>;
}
