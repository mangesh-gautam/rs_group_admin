"use client";

import { DocumentSkeleton } from "@/components/ui/Skeleton";
import { useEffect, useState } from "react";
import { Alert } from "@/components/auth/FormControls";
import { Icon } from "@/components/icons";
import type { DocumentKind } from "@/lib/accounts/types";
import { errorMessage } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Loads a PAN / Aadhaar copy on demand (each view is audit-logged by the API)
 * and shows it in a dialog. Data URLs are turned into blob URLs so PDFs can
 * be displayed in an iframe.
 */
export function DocumentViewer({
  accountNo,
  kind,
  title,
  onClose,
}: {
  accountNo: string;
  kind: DocumentKind;
  title: string;
  onClose: () => void;
}) {
  const { authFetch } = useAuth();
  const [doc, setDoc] = useState<{ url: string; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    authFetch<{ mime: string; dataUrl: string }>(
      `/api/customers/account-holders/${encodeURIComponent(accountNo)}/documents/${kind}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        const blob = await (await fetch(res.dataUrl)).blob();
        url = URL.createObjectURL(blob);
        setDoc({ url, mime: res.mime });
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(errorMessage(err));
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [authFetch, accountNo, kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="truncate font-semibold text-navy">{title}</h2>
          <div className="flex items-center gap-2">
            {doc && (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-navy hover:bg-slate-50"
              >
                <Icon name="download" className="size-3.5" /> Open in new tab
              </a>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
              <Icon name="x" className="size-5" />
            </button>
          </div>
        </div>
        <div className="grid min-h-[50vh] flex-1 place-items-center overflow-auto bg-slate-100 p-4">
          {error ? (
            <Alert tone="error">{error}</Alert>
          ) : !doc ? (
            <DocumentSkeleton />
          ) : doc.mime === "application/pdf" ? (
            <iframe src={doc.url} title={title} className="h-[75vh] w-full rounded bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL of the uploaded copy
            <img src={doc.url} alt={title} className="max-h-[75vh] max-w-full rounded object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}
