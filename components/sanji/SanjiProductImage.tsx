"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const NO_IMAGES: string[] = [];

export default function SanjiProductImage({ mainImage, images = NO_IMAGES, name, autoPlay = false, eager = false }: {
  mainImage: string | null; images?: string[]; name: string; autoPlay?: boolean; eager?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const photos = useMemo(() => [...new Set([mainImage, ...images]
    .filter((src): src is string => typeof src === "string" && !!src.trim())
    .map(src => src.trim()))].filter(src => !failed.has(src)), [mainImage, images, failed]);
  const multiple = photos.length > 1;
  const current = photos[index % photos.length];
  const next = photos[(index + 1) % photos.length];
  const nextLoaded = loaded.has(next);
  const playing = autoPlay && multiple && inView && !reducedMotion;

  useEffect(() => {
    if (!autoPlay || !multiple) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    const observer = "IntersectionObserver" in window ? new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting && entry.intersectionRatio >= 0.15);
    }, { threshold: [0, 0.15] }) : null;
    if (observer && root.current) observer.observe(root.current);
    else setInView(true);
    return () => { observer?.disconnect(); media.removeEventListener("change", updateMotion); };
  }, [autoPlay, multiple]);

  useEffect(() => {
    if (!playing || !nextLoaded) return;
    const timer = window.setInterval(() => {
      const link = root.current?.closest("a");
      if (document.hidden || link?.matches(":hover, :focus-within")) return;
      setIndex(value => value + 1);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [playing, nextLoaded, next]);

  // Keep the outgoing image for the fade, and preload only the next visible card image.
  const frames = playing ? [...new Set([
    ...(index > 0 ? [photos[(index - 1) % photos.length]] : []), current, next,
  ])] : current ? [current] : [];
  const markLoaded = (src: string) => {
    if (!loaded.has(src)) setLoaded(previous => new Set(previous).add(src));
  };
  const markFailed = (src: string) => {
    if (!failed.has(src)) { setFailed(previous => new Set(previous).add(src)); setIndex(0); }
  };

  return <div className="sj-product-gallery" ref={root} data-image-slideshow={autoPlay && multiple ? "true" : undefined}>
    {frames.length ? frames.map(src => <img
      key={src}
      src={src}
      alt={src === current ? name : ""}
      aria-hidden={src !== current || undefined}
      className={src === current ? "is-active" : ""}
      loading={src === current && !eager ? "lazy" : "eager"}
      decoding="async"
      ref={image => { if (image?.complete) { if (image.naturalWidth > 0) markLoaded(src); else markFailed(src); } }}
      onLoad={() => markLoaded(src)}
      onError={() => markFailed(src)}
    />) : <span className="sj-product-placeholder">산지픽</span>}
  </div>;
}
