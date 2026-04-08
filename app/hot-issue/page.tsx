import Header from "@/components/Header";

export default function HotIssuePage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">HOT ISSUE</h1>
        <p className="text-sm text-gray-400 mb-10">진행 예정 공구 일정</p>
        <p className="text-gray-300 text-center py-32">공구 일정을 준비 중입니다.</p>
      </section>
    </main>
  );
}
