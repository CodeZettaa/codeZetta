import { receiveWebhook } from "@/features/commerce/service";
import { MOCK_SIGNATURE_HEADER } from "@/features/commerce/provider";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const rawBody = await request.text();
  const signature = request.headers.get(MOCK_SIGNATURE_HEADER);
  const result = await receiveWebhook(provider, rawBody, signature);
  return Response.json({ outcome: result.outcome }, { status: result.httpStatus });
}
