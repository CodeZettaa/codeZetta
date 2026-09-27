import type { Metadata } from "next";
import { CheckoutResult } from "@/features/commerce/components/checkout-result";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Payment" };

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order = "" } = await searchParams;
  return <CheckoutResult orderNumber={order} />;
}
