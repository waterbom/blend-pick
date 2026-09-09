// Browser-only helpers shared by paste, drop and the editor's DOM regression harness.
export const PENDING_IMAGE = 'data-editor-upload';
const imageTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
export function transferImages(data: DataTransfer): File[] {
  const files = Array.from(data.files || []);
  const candidates = files.length ? files : Array.from(data.items || []).map(item => item.getAsFile()).filter((f): f is File => !!f);
  return candidates.flatMap(file => {
    const type = file.type || imageTypes[file.name.split('.').pop()?.toLowerCase() || ''];
    return type?.startsWith('image/') ? [file.type ? file : new File([file], file.name, { type })] : [];
  });
}
export function imageSource(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value) || value.startsWith('blob:')) return value;
  try {
    const url = new URL(value, document.baseURI);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* Unsupported or local-file source. */ }
  return null;
}
export function cleanEditorHTML(html: string): DocumentFragment {
  const template = document.createElement('template'); template.innerHTML = html;
  template.content.querySelectorAll('video,iframe,script,embed,object,source,track,svg,math,style,link,meta,base,form,input,button').forEach(n => n.remove());
  template.content.querySelectorAll<HTMLElement>('*').forEach(el => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name) || ['srcdoc','contenteditable',PENDING_IMAGE,'srcset'].includes(attr.name)) el.removeAttribute(attr.name);
      if (['href','xlink:href'].includes(attr.name) && !/^(https?:|mailto:|tel:|#|\/)/i.test(attr.value.trim())) el.removeAttribute(attr.name);
    }
    if (/url\s*\(|expression\s*\(|position\s*:\s*(fixed|absolute)/i.test(el.getAttribute('style') || '')) el.removeAttribute('style');
    if (el.tagName === 'IMG') {
      const raw = el.getAttribute('data-src') || el.getAttribute('data-original') || el.getAttribute('src') || '';
      const src = imageSource(raw);
      if (src) el.setAttribute('src', src); else el.removeAttribute('src');
      el.removeAttribute('data-src'); el.removeAttribute('data-original');
      el.style.maxWidth = '100%'; el.style.height = 'auto';
    }
  });
  return template.content;
}
export function editorHTML(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(`[${PENDING_IMAGE}]`).forEach(n => n.remove());
  return copy.innerHTML;
}
export function editorRange(el: HTMLElement, point?: { x: number; y: number }): Range {
  const doc = el.ownerDocument;
  const positionDoc = doc as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  let range: Range | null = null;
  if (point) {
    const pos = positionDoc.caretPositionFromPoint?.(point.x, point.y);
    if (pos) { range = doc.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true); }
    else range = doc.caretRangeFromPoint?.(point.x, point.y) || null;
  } else {
    const selection = doc.getSelection();
    if (selection?.rangeCount) range = selection.getRangeAt(0).cloneRange();
  }
  if (!range || !el.contains(range.startContainer) || !el.contains(range.endContainer)) {
    range = doc.createRange(); range.selectNodeContents(el); range.collapse(false);
  }
  return range;
}
export function insertEditorFragment(el: HTMLElement, fragment: DocumentFragment, range: Range) {
  const last = fragment.lastChild;
  range.deleteContents(); range.insertNode(fragment);
  if (last) { range.setStartAfter(last); range.collapse(true); }
  el.focus(); const selection = el.ownerDocument.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
}
