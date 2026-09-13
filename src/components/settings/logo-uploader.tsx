"use client";

import { useState, useRef, useTransition } from "react";
import { uploadBusinessLogo, removeBusinessLogo } from "@/lib/actions/settings";
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface LogoUploaderProps {
  businessId: string;
  initialLogoUrl: string | null;
  isReadOnly?: boolean;
  onLogoChange?: (newUrl: string | null) => void;
}

const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export function LogoUploader({
  businessId,
  initialLogoUrl,
  isReadOnly = false,
  onLogoChange,
}: LogoUploaderProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function clearFeedback() {
    setError(null);
    setSuccess(null);
  }

  function handleFileSelection(file: File) {
    clearFeedback();

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please upload a supported image format (PNG, JPG, WEBP, or SVG).");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Image size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }

    // Immediately create a temporary local preview while uploading
    const localPreview = URL.createObjectURL(file);
    setLogoUrl(localPreview);

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const res = await uploadBusinessLogo(businessId, formData);
      if ("error" in res && res.error) {
        setError(res.error);
        setLogoUrl(initialLogoUrl);
      } else if ("ok" in res && res.logoUrl) {
        setLogoUrl(res.logoUrl);
        setSuccess("Logo uploaded successfully!");
        onLogoChange?.(res.logoUrl);
        setTimeout(() => setSuccess(null), 4000);
      }
    });
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (isReadOnly || isPending) return;
    setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (isReadOnly || isPending) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
    // reset input so same file can be re-selected if desired
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRemove() {
    clearFeedback();
    if (isReadOnly || isPending) return;

    startTransition(async () => {
      const res = await removeBusinessLogo(businessId);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setLogoUrl(null);
        setSuccess("Logo removed successfully.");
        onLogoChange?.(null);
        setTimeout(() => setSuccess(null), 4000);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
          Business Logo
        </label>
        {isReadOnly ? (
          <span className="text-xs text-slate-400">View only</span>
        ) : null}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileInputChange}
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        disabled={isReadOnly || isPending}
        aria-label="Upload logo file"
      />

      {logoUrl ? (
        /* CURRENT LOGO PREVIEW CARD */
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {/* Contained Preview Box */}
              <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-inner">
                <img
                  src={logoUrl}
                  alt="Business Logo Preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Current Logo</p>
                <p className="text-xs text-slate-500">
                  Visible on TV displays, customer tickets, and your dashboard.
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  PNG, JPG, WEBP, or SVG • Max {MAX_FILE_SIZE_MB}MB
                </p>
              </div>
            </div>

            {!isReadOnly ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                  )}
                  Replace
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* DRAG AND DROP UPLOAD ZONE */
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !isReadOnly && !isPending && fileInputRef.current?.click()}
          className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
            isReadOnly
              ? "cursor-not-allowed border-slate-200 bg-slate-50"
              : isDragging
                ? "border-emerald-500 bg-emerald-50/50"
                : "cursor-pointer border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-100/60"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition group-hover:scale-105">
            {isPending ? (
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            ) : isDragging ? (
              <UploadCloud className="h-6 w-6 text-emerald-600" />
            ) : (
              <ImageIcon className="h-6 w-6 text-slate-400 group-hover:text-slate-600" />
            )}
          </div>

          <div className="mt-3">
            <p className="text-sm font-semibold text-slate-800">
              {isPending
                ? "Uploading logo..."
                : isDragging
                  ? "Drop image to upload"
                  : isReadOnly
                    ? "No logo configured"
                    : "Drag & drop your logo here, or browse"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Supports PNG, JPG, WEBP, or SVG • Maximum {MAX_FILE_SIZE_MB}MB
            </p>
          </div>

          {!isReadOnly && !isPending ? (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 group-hover:border-slate-400"
            >
              Select File
            </button>
          ) : null}
        </div>
      )}

      {/* FEEDBACK BANNERS */}
      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}
    </div>
  );
}
