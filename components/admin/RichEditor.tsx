"use client";

import { useEffect, useRef, useState } from 'react';
import { shrinkImage, uploadErrorMessage } from '@/lib/client-image';
import { cleanEditorHTML, editorHTML, editorRange, imageSource, insertEditorFragment, PENDING_IMAGE, transferImages } from '@/lib/rich-editor';

export default function RichEditor({ value, onChange, className = '', style, placeholder, uploadUrl = '/api/admin/upload', onUploadingChange }: {
  value: string; onChange: (html: string) => void; className?: string; style?: React.CSSProperties;
  placeholder?: string; uploadUrl?: string; onUploadingChange?: (uploading: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const count = useRef(0), internalDrag = useRef(false), mounted = useRef(true);
  const change = useRef(onChange), uploadChange = useRef(onUploadingChange);
  change.current = onChange; uploadChange.current = onUploadingChange;
  const [uploading, setUploading] = useState(false), [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const el = ref.current;
    if (el && !count.current && document.activeElement !== el && editorHTML(el) !== (value || '')) {
      el.replaceChildren(cleanEditorHTML(value || ''));
    }
  }, [value]);
  const sync = () => { if (ref.current) change.current(editorHTML(ref.current)); };
  function pending(delta: number) {
    count.current += delta;
    if (mounted.current) { setUploading(count.current > 0); uploadChange.current?.(count.current > 0); }
  }

  // Insert placeholders synchronously at the drop/paste position, then replace
  // those exact nodes. Moving focus while the network is busy cannot move images.
  async function receive(data: DataTransfer, range: Range) {
    const el = ref.current; if (!el) return;
    const files = transferImages(data), html = data.getData('text/html');
    const uri = data.getData('text/uri-list').split(/\r?\n/).find(line => line && !line.startsWith('#'));
    const fragment = html ? cleanEditorHTML(html) : document.createDocumentFragment();
    if (!html && !files.length && uri) {
      const src = imageSource(uri); if (src) { const img = document.createElement('img'); img.src = src; fragment.append(img); }
    }
    const images = Array.from(fragment.querySelectorAll('img'));
    while (images.length < files.length) { const img = document.createElement('img'); fragment.append(img); images.push(img); }
    const jobs: { marker: HTMLElement; img: HTMLImageElement; file?: File; src?: string }[] = [];
    images.forEach((img, i) => {
      img.style.maxWidth = '100%'; img.style.height = 'auto';
      const src = img.getAttribute('src') || '', file = files[i];
      if (file || src.startsWith('data:') || src.startsWith('blob:')) {
        const marker = document.createElement('span'); marker.setAttribute(PENDING_IMAGE, 'true');
        marker.contentEditable = 'false'; marker.textContent = '이미지 업로드 중…';
        marker.style.cssText = 'display:inline-block;padding:12px;background:#f1f5f0;color:#46633f';
        img.replaceWith(marker); jobs.push({ marker, img, file, src });
      } else if (!src) { img.remove(); setError('이 이미지는 직접 읽을 수 없어요. 사진 파일을 끌어다 놓거나 이미지 자체를 복사해주세요.'); }
    });
    if (jobs.length) pending(jobs.length);
    insertEditorFragment(el, fragment, range); sync();
    for (const job of jobs) {
      try {
        let raw = job.file;
        if (!raw) {
          const response = await fetch(job.src!); const blob = await response.blob();
          raw = new File([blob], 'pasted-image', { type: blob.type });
        }
        const file = await shrinkImage(raw, { maxWidth: 1600 });
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch(uploadUrl, { method: 'POST', body: fd });
        const result = await res.json().catch(() => null);
        if (!res.ok || typeof result?.url !== 'string') throw Error(uploadErrorMessage(res.status, result));
        const src = imageSource(result.url);
        if (!src || /^(data:|blob:)/.test(src)) throw Error('업로드된 이미지 주소를 확인하지 못했어요. 다시 시도해주세요.');
        // Do not resurrect a placeholder the user already removed.
        if (mounted.current && el.contains(job.marker)) {
          job.img.setAttribute('src', result.url); job.marker.replaceWith(job.img); sync();
        }
      } catch (e) {
        job.marker.remove();
        if (mounted.current) { setError(e instanceof Error ? e.message : '사진 업로드에 실패했어요. 다시 시도해주세요.'); sync(); }
      } finally { pending(-1); }
    }
  }
  function handles(data: DataTransfer) {
    return transferImages(data).length > 0 || !!data.getData('text/html').trim() || !!data.getData('text/uri-list').trim();
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-label={placeholder || '상세 내용'} aria-multiline="true" aria-busy={uploading}
        onInput={sync} onBlur={sync}
        onPaste={e => { if (!handles(e.clipboardData) || !ref.current) return; e.preventDefault(); setError(''); void receive(e.clipboardData, editorRange(ref.current)); }}
        onDragStart={() => { internalDrag.current = true; }} onDragEnd={() => { internalDrag.current = false; }}
        onDrop={e => {
          if (internalDrag.current) { internalDrag.current = false; return; }
          if (!ref.current || !handles(e.dataTransfer)) return;
          e.preventDefault(); setError(''); void receive(e.dataTransfer, editorRange(ref.current, { x: e.clientX, y: e.clientY }));
        }}
        onDragOver={e => { if (['Files','text/html','text/uri-list'].some(type => e.dataTransfer.types.includes(type))) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
        onErrorCapture={e => { if (e.target instanceof HTMLImageElement) setError('이미지를 불러오지 못했어요. 외부 사이트에서 차단한 이미지라면 사진 파일을 직접 끌어다 놓아주세요.'); }}
        className={className} style={style} data-placeholder={placeholder} />
      {uploading && <p role="status" className="mt-2 text-xs text-green-700">사진을 업로드하고 있어요. 완료되면 저장할 수 있습니다.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
