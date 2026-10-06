"use client";

import { useId } from "react";
import styles from "@/components/BlendHeader.module.css";

export const BLEND_INSTAGRAM_URL = "https://www.instagram.com/blend_punch/";

export default function InstagramLink() {
  const gradientId = useId();
  return (
    <a
      href={BLEND_INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.instagram}
      aria-label="블랜드펀치 인스타그램 (새 창)"
      title="블랜드펀치 인스타그램"
    >
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="2" y1="22" x2="21" y2="2" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ed9a39" />
            <stop offset=".5" stopColor="#d93972" />
            <stop offset="1" stopColor="#8347b7" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="18" height="18" rx="5.5" stroke={`url(#${gradientId})`} strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.2" stroke={`url(#${gradientId})`} strokeWidth="1.8" />
        <circle cx="17.6" cy="6.5" r="1.1" fill="#a243a0" />
      </svg>
    </a>
  );
}
