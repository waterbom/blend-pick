"use client";

import { useEffect, useRef } from "react";

/**
 * contenteditable 리치 에디터 (OS sales-pages 상세내용과 동일 방식).
 * - 스마트스토어 등에서 글씨+이미지를 드래그 복사 후 Ctrl+V → 서식·이미지 HTML 그대로 붙여넣음(네이티브)
 * - 순수 이미지(스크린샷 등)만 붙여넣으면 업로드 후 <img> 삽입(base64 방지)
 */
export default function RichEditor({
  value,
  onChange,
  className = "",
  style,
  placeholder,
  uploadUrl = "/api/admin/upload",
}: {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  uploadUrl?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // 외부 값 변경(초기 로드 등) 반영 — 편집 중(포커스)엔 커서 튐 방지 위해 건드리지 않음
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== (value || "")) {
      el.innerHTML = value || "";
    }
  }, [value]);

  const sync = () => onChange(ref.current?.innerHTML || "");

  async function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const cd = e.clipboardData;
    const html = cd.getData("text/html");
    // 서식/이미지 포함 HTML → 네이티브 붙여넣기 그대로 (스마트스토어 복사 대응)
    if (html && html.trim()) {
      setTimeout(sync, 0);
      return;
    }
    // 순수 이미지만 → 업로드 후 삽입
    for (const item of Array.from(cd.items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        try {
          const res = await fetch(uploadUrl, { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.url) {
            document.execCommand("insertHTML", false, `<img src="${data.url}" style="max-width:100%;" />`);
            sync();
          }
        } catch {
          /* 업로드 실패 시 무시 */
        }
        return;
      }
    }
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={sync}
      onBlur={sync}
      onPaste={handlePaste}
      className={className}
      style={style}
      data-placeholder={placeholder}
    />
  );
}
