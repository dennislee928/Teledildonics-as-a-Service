"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Play, Terminal, Waypoints } from "lucide-react";

interface ApiExplorerProps {
  title: string;
  endpoint: string;
  description: string;
  children: React.ReactNode;
  onExecute: () => Promise<unknown>;
  actionLabel?: string;
}

interface ExplorerFieldProps {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

interface ExplorerNoticeProps {
  tone?: "default" | "warning";
  children: React.ReactNode;
}

interface ExplorerSegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

interface ExplorerEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body: string;
}

export function ApiExplorer({
  title,
  endpoint,
  description,
  children,
  onExecute,
  actionLabel = "Run request",
}: ApiExplorerProps) {
  const [response, setResponse] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onExecute();
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown request failure");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="eyebrow">
              <Waypoints size={12} />
              API Explorer
            </div>
            <div className="space-y-2">
              <h1 className="page-title">{title}</h1>
              <p className="page-copy max-w-3xl">{description}</p>
            </div>
          </div>
          <div className="status-pill mono-copy">
            <Terminal size={14} className="text-[var(--accent)]" />
            {endpoint}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <div className="surface space-y-6">
          <div className="space-y-2">
            <p className="metric-label">Request payload</p>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Inputs are wired to the real demo workspace. Keep the shapes clean and the output becomes much easier to read.
            </p>
          </div>

          <div className="space-y-5">{children}</div>

          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--text-soft)]">Workspace auth uses `taas_demo_workspace_key`.</p>
            <button type="button" onClick={handleExecute} disabled={loading} className="btn-primary">
              {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={16} />}
              {loading ? "Running…" : actionLabel}
            </button>
          </div>
        </div>

        <div className="surface-terminal response-frame">
          <div className="response-header">
            <div>
              <p className="metric-label">Response</p>
              <p className="text-sm text-[var(--text-muted)]">JSON payload and runtime feedback</p>
            </div>
            {loading ? (
              <div className="status-pill">
                <LoaderCircle size={13} className="animate-spin text-[var(--accent)]" />
                In flight
              </div>
            ) : error ? (
              <div className="status-pill">
                <AlertTriangle size={13} className="text-[var(--accent)]" />
                Request failed
              </div>
            ) : response ? (
              <div className="status-pill">
                <CheckCircle2 size={13} className="text-[var(--success)]" />
                Request complete
              </div>
            ) : (
              <div className="status-pill">Idle</div>
            )}
          </div>

          <div className="response-body">
            {loading ? (
              <div className="flex h-full min-h-[20rem] flex-col items-center justify-center gap-4 text-[var(--text-muted)]">
                <LoaderCircle size={30} className="animate-spin text-[var(--accent)]" />
                <p className="mono-copy text-sm">Awaiting API response…</p>
              </div>
            ) : error ? (
              <div className="note-card note-card-warning mono-copy">
                <p className="mb-2 text-sm font-semibold text-[var(--text)]">Request failed</p>
                <p className="terminal-copy">{error}</p>
              </div>
            ) : response ? (
              <pre className="terminal-copy mono-copy">{JSON.stringify(response, null, 2)}</pre>
            ) : (
              <div className="flex h-full min-h-[20rem] flex-col items-center justify-center gap-4 text-center text-[var(--text-soft)]">
                <Terminal size={34} className="text-[var(--accent)]" />
                <p className="mono-copy text-sm">Run the request to inspect the live payload.</p>
              </div>
            )}
          </div>

          <div className="response-footer text-sm text-[var(--text-soft)]">
            <span className="mono-copy">application/json</span>
            <span className="mono-copy">Live demo workspace</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ExplorerField({ label, icon, children }: ExplorerFieldProps) {
  return (
    <div className="field-group">
      <div className="field-label">
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

export function ExplorerNotice({ tone = "default", children }: ExplorerNoticeProps) {
  return <div className={`note-card ${tone === "warning" ? "note-card-warning" : ""}`}>{children}</div>;
}

export function ExplorerSegmented<T extends string>({
  value,
  options,
  onChange,
}: ExplorerSegmentedProps<T>) {
  return (
    <div className="tab-strip">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`tab-chip ${active ? "tab-chip-active" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ExplorerEmptyState({ icon, title, body }: ExplorerEmptyStateProps) {
  return (
    <div className="surface-muted flex flex-col items-center gap-3 !rounded-[22px] !p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-[var(--text)]">{title}</p>
        <p className="text-sm leading-6 text-[var(--text-muted)]">{body}</p>
      </div>
    </div>
  );
}
