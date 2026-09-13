"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import type { AiProvider, AiProvidersInfo } from "@/lib/types";
import { SparklesIcon } from "./icons";
import { Dropdown, Spinner, type DropdownOption } from "./ui";

interface AiEngineSelectProps {
  variant?: "menu" | "sidebar";
}

const DEFAULT: AiProvidersInfo = {
  current: "gemini",
  providers: [
    { value: "openai", label: "OpenAI", model: "gpt-4o-mini", models: [], available: false },
    { value: "gemini", label: "Google Gemini", model: "gemini-3.5-flash", models: [], available: false },
  ],
};

function syncEventName() {
  return "traveltok:ai-engine";
}

function dispatchSync() {
  window.dispatchEvent(new Event(syncEventName()));
}

export function AiEngineSelect({ variant = "sidebar" }: AiEngineSelectProps) {
  const [info, setInfo] = useState<AiProvidersInfo>(DEFAULT);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelSaving, setModelSaving] = useState(false);

  const fetchInfo = () => {
    return api<AiProvidersInfo>("/ai/providers")
      .then((data) => {
        setInfo(data);
        setError(null);
      })
      .catch(() => setInfo(DEFAULT))
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    void fetchInfo();
  }, []);

  useEffect(() => {
    const onSync = () => {
      setFetching(true);
      void fetchInfo();
    };
    window.addEventListener(syncEventName(), onSync);
    return () => window.removeEventListener(syncEventName(), onSync);
  }, []);

  const changeProvider = async (value: AiProvider) => {
    if (value === info.current || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<AiProvidersInfo>("/ai/provider", {
        method: "PUT",
        body: { provider: value },
      });
      setInfo(data);
      dispatchSync();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const changeModel = async (model: string) => {
    const gemini = info.providers.find((p) => p.value === "gemini");
    if (!gemini || model === gemini.model || modelSaving) return;
    setModelSaving(true);
    setError(null);
    try {
      const data = await api<AiProvidersInfo>("/ai/model", {
        method: "PUT",
        body: { provider: "gemini", model },
      });
      setInfo(data);
      dispatchSync();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setModelSaving(false);
    }
  };

  const gemini = info.providers.find((p) => p.value === "gemini");
  const isGemini = info.current === "gemini";
  const showModelSelect = isGemini && Boolean(gemini?.models.length);

  const label = (
    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
      <SparklesIcon style={{ width: 13, height: 13 }} className="text-emerald-500 dark:text-emerald-400" />
      AI Engine
    </p>
  );

  const body = (
    <>
      {fetching ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-white/10">
          <Spinner className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Memuat AI engine…
          </span>
        </div>
      ) : (
        <Dropdown
          value={info.current}
          onChange={(v) => changeProvider(v as AiProvider)}
          disabled={loading}
          placeholder="Pilih provider…"
          options={info.providers.map(
            (p): DropdownOption => ({
              value: p.value,
              label: p.available ? p.label : `${p.label} (no API key)`,
              disabled: !p.available,
            }),
          )}
        />
      )}

      {showModelSelect && gemini && (
        <Dropdown
          value={gemini.model}
          onChange={changeModel}
          disabled={modelSaving}
          placeholder="Select model…"
          options={gemini.models.map((m): DropdownOption => ({ value: m, label: m }))}
          className="mt-2"
        />
      )}

      {showModelSelect && gemini && (
        <p className="mt-1.5 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
          Setiap model punya kuota harian sendiri. Kalau satu model habis kuota, ganti ke model
          lain supaya tetap bisa generate.
        </p>
      )}

      {error && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{error}</p>}
      {loading && <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">Menyimpan…</p>}
      {modelSaving && <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">Menyimpan model…</p>}
    </>
  );

  if (variant === "menu") {
    return (
      <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
        {label}
        {body}
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 p-3 dark:border-white/10">
      <div className="px-1">
        {label}
      </div>
      {body}
    </div>
  );
}
