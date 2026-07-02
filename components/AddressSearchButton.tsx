"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        onclose?: () => void;
        width?: number;
        height?: number;
      }) => { open: () => void };
    };
  }
}

interface DaumPostcodeData {
  zonecode: string;       // 우편번호
  roadAddress: string;    // 도로명 주소
  jibunAddress: string;   // 지번 주소
  autoJibunAddress: string;
  userSelectedType: "R" | "J"; // R=도로명, J=지번
}

interface Props {
  onSelect: (zipcode: string, address: string) => void;
}

const SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

export default function AddressSearchButton({ onSelect }: Props) {
  useEffect(() => {
    if (document.querySelector(`script[src="${SCRIPT_URL}"]`)) return;
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    document.head.appendChild(s);
  }, []);

  function openSearch() {
    if (!window.daum?.Postcode) return;
    new window.daum.Postcode({
      oncomplete(data) {
        const address =
          data.userSelectedType === "R" ? data.roadAddress : data.jibunAddress;
        onSelect(data.zonecode, address);
      },
    }).open();
  }

  return (
    <button
      type="button"
      onClick={openSearch}
      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-95"
      style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--line)" }}
    >
      🔍 우편번호 검색
    </button>
  );
}
