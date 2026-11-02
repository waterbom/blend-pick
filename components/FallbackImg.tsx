"use client";

import { useState } from "react";

interface Props {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  fallbackText?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}

export default function FallbackImg({ src, alt, className, style, fallbackText = "이미지 없음", loading, fetchPriority }: Props) {
  const url = typeof src === "string" ? src.trim() : "";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!url || failedSrc === url) {
    return (
      <div
        className={className}
        role="img"
        aria-label={alt || fallbackText}
        style={{ ...style, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--surface-soft, #f5f0eb)" }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B7BDAD" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <span style={{ fontSize: 11, color: "#8A9484" }}>{fallbackText}</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      style={{ display: "block", maxWidth: "100%", ...style }}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      onError={() => setFailedSrc(url)}
    />
  );
}

