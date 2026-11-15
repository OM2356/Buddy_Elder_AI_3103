import React, { useState } from 'react';
import { AlertCircle, ImageOff, Inbox, RotateCcw } from 'lucide-react';

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-24 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 animate-pulse p-5"
        >
          <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
          <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-900 dark:text-red-200"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-red-700 dark:text-red-400" aria-hidden="true" />
        <div>
          <p className="font-semibold">Attention needed</p>
          <p className="text-[18px] opacity-95">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-700 text-white font-semibold hover:bg-red-800 transition-colors shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Try Again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
        <Inbox className="w-6 h-6" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-slate-600 dark:text-slate-300 max-w-lg mx-auto">{description}</p>
      {actionLabel && onAction && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onAction}
            className="px-6 py-3 rounded-xl bg-[#0F766E] text-white font-semibold hover:bg-[#0D635D] transition-colors cursor-pointer"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export function SafeImage({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#EFF6FF] to-[#E6F4F1] dark:from-slate-800 dark:to-slate-900 text-[#0F2544] dark:text-slate-200 p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="w-8 h-8 mb-2 opacity-60" aria-hidden="true" />
        <span className="text-base font-medium">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
