"use client";

import { useEffect, useRef } from "react";
import { fbqTrack } from "@/lib/analytics";

// One event per mounted view/key, including React's development effect replay.
export function useMetaEvent(event: string, key: string, params: Record<string, unknown>, enabled = true) {
  const last = useRef("");
  useEffect(() => {
    const identity = `${event}:${key}`;
    if (!enabled || last.current === identity) return;
    if (fbqTrack(event, params)) last.current = identity;
  }, [event, key, params, enabled]);
}
