"use client";

import { useParams } from "next/navigation";
import ProductFormClient from "@/components/admin/ProductFormClient";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  return <ProductFormClient mode="edit" productId={id} />;
}
