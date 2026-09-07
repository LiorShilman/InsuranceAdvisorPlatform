import { Decimal } from "decimal.js";

/**
 * Money — PRD §25.
 *
 * "No calculation may use raw JS floating point. Money = Decimal."
 *
 * Internally backed by decimal.js, always normalized to 2 decimal places
 * (whole agorot / cents) so repeated arithmetic cannot drift the way raw
 * `number` addition can. Every arithmetic operation returns a new Money —
 * instances are immutable.
 */
export class Money {
  private readonly value: Decimal;

  private constructor(value: Decimal) {
    this.value = value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  static fromNumber(value: number): Money {
    if (!Number.isFinite(value)) {
      throw new Error(`Money.fromNumber received a non-finite value: ${value}`);
    }
    return new Money(new Decimal(value));
  }

  static fromString(value: string): Money {
    return new Money(new Decimal(value));
  }

  static fromDecimal(value: Decimal): Money {
    return new Money(value);
  }

  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  multiply(factor: number | Decimal): Money {
    return new Money(this.value.times(factor));
  }

  divide(divisor: number | Decimal): Money {
    return new Money(this.value.dividedBy(divisor));
  }

  /** max(0, this) — used constantly for gap calculations (PRD §12.2, §13.3, §16). */
  static max(...values: Money[]): Money {
    if (values.length === 0) {
      return Money.zero();
    }
    return values.reduce((max, current) => (current.greaterThan(max) ? current : max));
  }

  static sum(values: Money[]): Money {
    return values.reduce((total, current) => total.add(current), Money.zero());
  }

  negate(): Money {
    return new Money(this.value.negated());
  }

  isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  greaterThan(other: Money): boolean {
    return this.value.greaterThan(other.value);
  }

  lessThan(other: Money): boolean {
    return this.value.lessThan(other.value);
  }

  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  /** Exact value as a decimal string, e.g. "1850000.00" — what audit trails must store (PRD §25). */
  toExactString(): string {
    return this.value.toFixed(2);
  }

  toNumber(): number {
    return this.value.toNumber();
  }

  /**
   * Presentation rounding — PRD §25: "nearest 1,000 / nearest 10,000 / exact".
   * Never mutates the underlying exact value; only affects what's displayed.
   */
  toDisplayString(rounding: PresentationRounding = "exact"): string {
    const rounded = this.roundForDisplay(rounding);
    return rounded.toFixed(0);
  }

  toDisplayNumber(rounding: PresentationRounding = "exact"): number {
    return this.roundForDisplay(rounding).toNumber();
  }

  private roundForDisplay(rounding: PresentationRounding): Decimal {
    switch (rounding) {
      case "nearest_1000":
        return this.value.dividedBy(1000).round().times(1000);
      case "nearest_10000":
        return this.value.dividedBy(10000).round().times(10000);
      case "exact":
        return this.value;
    }
  }
}

export type PresentationRounding = "nearest_1000" | "nearest_10000" | "exact";
