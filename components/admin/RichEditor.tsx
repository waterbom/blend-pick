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

  // 영상·iframe 등은 상세에서 재생 불가(검은 박스)인 데다 편집기에서 선택·삭제도 안 되므로 항상 제거
  const clean = () => {
    ref.current?.querySelectorAll("video, iframe, script, embed, object, source, track").forEach((n) => n.remove());
  };

  // 외부 값 변경(초기 로드 등) 반영 — 편집 중(포커스)엔 커서 튐 방지 위해 건드리지 않음
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== (value || "")) {
      el.innerHTML = value || "";
      clean(); // 기존에 저장된 영상 태그도 편집 화면에 여는 순간 정리 → 저장하면 사라짐
    }
  }, [value]);

  const sync = () => { clean(); onChange(ref.current?.innerHTML || ""); };

  // 이미지 파일들 업로드 후 커서 위치에 삽입 (붙여넣기·드래그 공통)
  async function uploadAndInsert(files: File[]) {
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(uploadUrl, { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.url) {
          ref.current?.focus();
          document.execCommand("insertHTML", false, `<img src="${data.url}" style="max-width:100%;" />`);
          sync();
        }
      } catch {
        /* 업로드 실패 시 무시 */
      }
    }
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const cd = e.clipboardData;
    const html = cd.getData("text/html");
    // 서식/이미지 포함 HTML → 네이티브 붙여넣기 그대로 (스마트스토어 복사 대응)
    if (html && html.trim()) {
      setTimeout(sync, 0);
      return;
    }
    // 순수 이미지만 → 업로드 후 삽입
    const files = Array.from(cd.items)
      .filter((it) => it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (files.length) {
      e.preventDefault();
      await uploadAndInsert(files);
    }
  }

  // 탐색기에서 사진 파일을 끌어다 놓으면 업로드 후 놓은 자리에 삽입
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return; // 텍스트 드래그 등은 브라우저 기본 동작 유지
    e.preventDefault();
    // 놓은 좌표에 커서를 옮겨 그 자리에 들어가게 (미지원 브라우저는 기존 커서 위치)
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    uploadAndInsert(files);
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={sync}
      onBlur={sync}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(e) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); }}
      className={className}
      style={style}
      data-placeholder={placeholder}
    />
  );
}
