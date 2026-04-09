import Link from "next/link";

const LETTERS = [
  { char: "B", color: "text-red-500" },
  { char: "L", color: "text-orange-500" },
  { char: "E", color: "text-yellow-500" },
  { char: "N", color: "text-green-500" },
  { char: "D", color: "text-teal-500" },
  { char: " ", color: "" },
  { char: "P", color: "text-blue-500" },
  { char: "I", color: "text-indigo-500" },
  { char: "C", color: "text-purple-500" },
  { char: "K", color: "text-pink-500" },
  { char: "E", color: "text-red-400" },
  { char: "D", color: "text-orange-400" },
  { char: " ", color: "" },
  { char: "Y", color: "text-yellow-400" },
  { char: "O", color: "text-green-400" },
  { char: "U", color: "text-blue-400" },
];

export default function BlendPickedBanner() {
  return (
    <section className="pb-6">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <p className="text-xs text-gray-400 tracking-widest uppercase mb-6">
          Special for you
        </p>
        <Link href="/blend-picked" className="group inline-block">
          <h2 className="text-6xl font-black tracking-tight leading-none group-hover:scale-105 transition-transform duration-300">
            {LETTERS.map((l, i) =>
              l.char === " " ? (
                <span key={i}>&nbsp;</span>
              ) : (
                <span key={i} className={l.color}>
                  {l.char}
                </span>
              )
            )}
          </h2>
          <div className="mt-6 flex items-center justify-center gap-4">
            <p className="text-sm text-gray-400 group-hover:text-gray-600 transition-colors">
              당신을 위해 엄선한 공구를 만나보세요 →
            </p>
            <span className="text-sm font-bold text-white bg-black px-4 py-1.5 hover:bg-gray-800 transition-colors">
              신청하기
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
