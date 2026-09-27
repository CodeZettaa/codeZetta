export function logPayment(event: string, fields: Record<string, string | number | boolean | null>) {
  console.info(JSON.stringify({ scope: "payment", event, ...fields }));
}
