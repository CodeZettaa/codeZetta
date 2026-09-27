import type { Metadata } from "next";
import { CheckoutResult } from "@/features/commerce/components/checkout-result";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Payment unsuccessful" };

export default async function CheckoutFailedPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order = "" } = await searchParams;
  return <CheckoutResult orderNumber={order} />;
}
