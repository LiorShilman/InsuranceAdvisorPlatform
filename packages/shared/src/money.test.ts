import { describe, expect, it } from "vitest";
import { Money } from "./money.js";

describe("Money (PRD §25 — no raw JS floating point drift)", () => {
  it("adds 1,000 values of 0.10 to exactly 100.00, unlike raw JS floats", () => {
    // Sanity check that the naive float approach actually does drift, so
    // this test is proving something.
    let floatTotal = 0;
    for (let i = 0; i < 1000; i++) {
      floatTotal += 0.1;
    }
    expect(floatTotal).not.toBe(100);

    let moneyTotal = Money.zero();
    for (let i = 0; i < 1000; i++) {
      moneyTotal = moneyTotal.add(Money.fromNumber(0.1));
    }
    expect(moneyTotal.toExactString()).toBe("100.00");
  });

  it("rounds to whole agorot on construction", () => {
    const value = Money.fromNumber(1850000.005);
    expect(value.toExactString()).toBe("1850000.01");
  });

  it("max(0, need - resources) never goes negative — PRD §12.2/§43 safety test", () => {
    const need = Money.fromNumber(700_000);
    const resources = Money.fromNumber(900_000);
    const gap = Money.max(Money.zero(), need.subtract(resources));
    expect(gap.isZero()).toBe(true);
    expect(gap.isNegative()).toBe(false);
  });

  it("reproduces the PRD §57 worked example arithmetic", () => {
    const grossNeed = Money.fromNumber(1_920_000).add(Money.fromNumber(180_000));
    expect(grossNeed.toExactString()).toBe("2100000.00");

    const offsets = Money.fromNumber(500_000).add(Money.fromNumber(200_000));
    const gap = Money.max(Money.zero(), grossNeed.subtract(offsets));
    expect(gap.toExactString()).toBe("1400000.00");
  });

  it("presentation rounding never changes the audited exact value", () => {
    const value = Money.fromNumber(1_234_567);
    expect(value.toDisplayString("nearest_1000")).toBe("1235000");
    expect(value.toDisplayString("nearest_10000")).toBe("1230000");
    expect(value.toExactString()).toBe("1234567.00");
  });
});
