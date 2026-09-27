export function logServerError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`[${scope}] ${message}`);
}
