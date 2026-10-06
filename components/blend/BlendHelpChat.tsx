"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { getHelpReply, HELP_TOPICS, type HelpReply } from "@/lib/blend-help";
import { kakaoChannelUrl } from "@/lib/kakao-commerce";
import styles from "./BlendHelpChat.module.css";

type Turn = { id: number; question: string; reply: HelpReply };
const MAX_TURNS = 20;
const MAX_QUESTION = 500;

function PickMark({ small = false }: { small?: boolean }) {
  return <span className={`${styles.pickMark} ${small ? styles.smallMark : ""}`} aria-hidden="true"><svg width="25" height="25" viewBox="0 0 28 28" fill="none"><path d="M23 12.5c0 5-4 8.5-9 8.5H9l-5 3 1.6-5A8 8 0 0 1 4 12.5C4 7.5 8 4 13.5 4S23 7.5 23 12.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="m13.5 8 1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2L9 12.5l3.2-1.3L13.5 8Z" fill="currentColor"/></svg></span>;
}

export default function BlendHelpChat({ open, onClose, kakaoUrl }: { open: boolean; onClose: () => void; kakaoUrl: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [showTopics, setShowTopics] = useState(false);
  const [feedback, setFeedback] = useState("");
  const atLimit = turns.length >= MAX_TURNS;
  const contactUrl = kakaoChannelUrl(kakaoUrl) ?? "https://pf.kakao.com/_VyING/chat";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      // 모바일에서는 창을 열자마자 키보드가 화면을 덮지 않도록 닫기 버튼에 먼저 초점을 둔다.
      closeRef.current?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      dialog.close();
      if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = turns.length > 0 ? scrollRef.current.scrollHeight : 0;
  }, [open, turns.length]);

  function ask(raw: string) {
    const value = raw.trim();
    if (!value || atLimit) return;
    if (value.length > MAX_QUESTION) {
      setFeedback("질문은 500자 이내로 적어 주세요.");
      return;
    }
    const turn = { id: nextId.current++, question: value, reply: getHelpReply(value) };
    setTurns(previous => previous.length >= MAX_TURNS ? previous : [...previous, turn]);
    setQuestion("");
    setShowTopics(false);
    setFeedback("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(question);
  }

  function enter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      ask(question);
    }
  }

  function reset() {
    setTurns([]);
    setQuestion("");
    setShowTopics(false);
    setFeedback("새 대화를 시작했어요.");
    closeRef.current?.focus({ preventScroll: true });
  }

  return <dialog ref={dialogRef} id="blend-help-chat" className={styles.dialog} aria-labelledby="blend-help-title" aria-describedby="blend-help-description" onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <PickMark />
        <div className={styles.identity}><h2 id="blend-help-title">블랜드픽 도우미</h2><p><span />자주 묻는 질문 자동 안내</p></div>
        <div className={styles.tools}><button type="button" onClick={reset} aria-label="새 대화 시작" title="새 대화"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg></button><button ref={closeRef} type="button" onClick={onClose} aria-label="도우미 닫기" title="닫기"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div>
      </header>

      <div className={styles.body} ref={scrollRef}>
        <p id="blend-help-description" className={styles.description}>주문·배송부터 숙박과 공급사 제안까지 안내해요.</p>
        {turns.length === 0 && <div className={styles.welcome}><span className={styles.eyebrow}>A LITTLE HELP, A GOOD PICK.</span><h3>궁금한 순간에도,<br /><em>블랜드픽과 함께.</em></h3><p>안녕하세요, 블랜드픽 도우미예요.<br />아래 질문을 고르거나 궁금한 내용을 적어 주세요.</p></div>}

        <div className={styles.conversation} role="log" aria-label="도우미 대화" aria-live="polite" aria-relevant="additions" aria-atomic="false">
          {turns.map(turn => <div className={styles.turn} key={turn.id}>
            <div className={styles.userMessage}><span className={styles.srOnly}>내 질문: </span>{turn.question}</div>
            <div className={styles.replyRow}><PickMark small /><div className={styles.replyContent}><span className={styles.replyName}>블랜드픽 도우미</span><div className={styles.answer}><p>{turn.reply.answer}</p>{turn.reply.links.length > 0 && <div className={styles.answerLinks}>{turn.reply.links.map(link => link.href.startsWith("/") ? <Link key={`${link.href}-${link.label}`} href={link.href} onClick={onClose}>{link.label}<span aria-hidden="true">→</span></Link> : <a key={`${link.href}-${link.label}`} href={link.href} target="_blank" rel="noopener noreferrer" onClick={onClose}>{link.label}<span aria-hidden="true">↗</span><span className={styles.srOnly}> (새 창)</span></a>)}</div>}</div></div></div>
          </div>)}
        </div>

        {!atLimit && <div className={styles.topicArea}>
          {turns.length > 0 ? <button type="button" className={styles.moreTopics} onClick={() => setShowTopics(value => !value)} aria-expanded={showTopics} aria-controls="blend-help-topics">{showTopics ? "질문 목록 접기" : "다른 질문도 궁금해요"}<span aria-hidden="true">{showTopics ? "−" : "+"}</span></button> : <p className={styles.topicLabel}><span aria-hidden="true">✳</span> 이런 질문을 많이 찾아요</p>}
          {(turns.length === 0 || showTopics) && <div className={styles.topics} id="blend-help-topics">{HELP_TOPICS.map(topic => <button key={topic.id} type="button" onClick={() => ask(topic.question)}>{topic.question}<span aria-hidden="true">↗</span></button>)}</div>}
        </div>}
        {atLimit && <div className={styles.limit} role="status">대화가 길어졌네요. 새 대화를 시작하거나 카카오 상담으로 이어가 주세요.<button type="button" onClick={reset}>새 대화 시작</button></div>}
      </div>

      <footer className={styles.footer}>
        <a className={styles.handoff} href={contactUrl} target="_blank" rel="noopener noreferrer" onClick={onClose}><span><b>직접 확인이 필요하다면</b><small>기존 카카오 상담으로 연결해요</small></span><strong>상담원 연결 <span aria-hidden="true">↗</span></strong><span className={styles.srOnly}> (새 창)</span></a>
        <form onSubmit={submit} className={styles.composer}>
          <label htmlFor="blend-help-question" className={styles.srOnly}>궁금한 내용</label>
          <textarea ref={inputRef} id="blend-help-question" value={question} onChange={event => { setQuestion(event.target.value); setFeedback(""); }} onKeyDown={enter} placeholder="궁금한 점을 입력해 주세요…" rows={2} maxLength={MAX_QUESTION} disabled={atLimit} aria-describedby="blend-help-privacy blend-help-feedback" />
          <div className={styles.composerActions}><span>{question.length}/{MAX_QUESTION}</span><button type="submit" disabled={!question.trim() || atLimit} aria-label="질문 보내기"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></div>
        </form>
        <p id="blend-help-privacy" className={styles.privacy}>개인정보는 적지 마세요. 주문 확인·접수는 연결된 화면에서 진행돼요.</p>
        <span id="blend-help-feedback" className={styles.feedback} role="status">{feedback}</span>
      </footer>
    </div>
  </dialog>;
}
