import { describe, it, expect } from "vitest";
import { isSimulatedTransaction, liveCreditTotal } from "./simulation";

describe("simulator payments are kept out of live totals", () => {
  it("TEST_ reference is a simulation", () => {
    expect(isSimulatedTransaction({ reference: "TEST_123" })).toBe(true);
  });
  it("Wema reference is live", () => {
    expect(isSimulatedTransaction({ reference: "WEMA-000013261008200036000049245580" })).toBe(false);
  });
  it("live total excludes the simulator ₦25,000 and keeps the real ₦50", () => {
    const rows = [
      { type: "credit", status: "completed", amount: 50, reference: "WEMA-1" },
      { type: "credit", status: "completed", amount: 25000, reference: "TEST_9" },
      { type: "credit", status: "completed", amount: 1000, reference: "X", metadata: { simulation: true } },
    ];
    expect(liveCreditTotal(rows)).toBe(50);
  });
});
