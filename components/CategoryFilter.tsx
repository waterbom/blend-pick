"use client";

import { useRouter } from "next/navigation";

interface Props {
  categories: string[];
  current: string;
}

export default function CategoryFilter({ categories, current }: Props) {
  const router = useRouter();

  return (
    <div className="flex gap-6 overflow-x-auto scrollbar-none">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => router.push(cat === "ALL" ? "/products" : `/products?category=${encodeURIComponent(cat)}`)}
          className={`py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
            current === cat
              ? "border-black text-black font-semibold"
              : "border-transparent text-gray-400 hover:text-black"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
