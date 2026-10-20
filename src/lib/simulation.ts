/** True when a payment came from the Payment Simulator (never real money). */
export function isSimulatedTransaction(t: {
  reference?: string | null;
  paystack_reference?: string | null;
  metadata?: unknown;
}): boolean {
  const m = (t.metadata ?? {}) as Record<string, unknown>;
  return (
    (t.reference ?? '').startsWith('TEST_') ||
    (t.paystack_reference ?? '').startsWith('TEST_') ||
    m.simulation === true || m.simulation === 'true' ||
    m.simulated === true || m.simulated === 'true'
  );
}

/** Live-only completed credits total. */
export function liveCreditTotal(
  rows: Array<{ type: string; status: string | null; amount: number | string; reference?: string | null; paystack_reference?: string | null; metadata?: unknown }>,
): number {
  return rows
    .filter(r => r.type === 'credit' && r.status === 'completed' && !isSimulatedTransaction(r))
    .reduce((s, r) => s + Number(r.amount || 0), 0);
}
