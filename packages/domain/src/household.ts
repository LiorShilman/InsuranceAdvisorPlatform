import { Money } from "@insurance-advisor/shared";
import type { BaseEntity } from "./base.js";

/**
 * Household / person entities — PRD §26.1. These are the inputs the
 * questionnaire (PRD §7) populates and the calculators (PRD §10-17) read.
 */

export type Person = BaseEntity & {
  clientProfileId: string;
  firstName?: string;
  dateOfBirth?: string;
  isPrimaryApplicant: boolean;
  isSpouse: boolean;
  retirementAge?: number;
};

export type Dependent = BaseEntity & {
  householdId: string;
  dateOfBirth?: string;
  relationship: "child" | "other_dependent";
  hasSpecialNeeds?: boolean;
  /** PRD §12.4 dependentTargetAge default lives in config; a per-dependent override is allowed. */
  targetIndependenceAgeOverride?: number;
};

export type Household = BaseEntity & {
  clientProfileId: string;
  maritalStatus: "single" | "married" | "divorced" | "widowed" | "partnered";
  dependents: Dependent[];
};

export type EmploymentStatus =
  | "employed"
  | "self_employed"
  | "business_owner"
  | "unemployed"
  | "retired"
  | "student"
  | "homemaker";

export type Employment = BaseEntity & {
  personId: string;
  status: EmploymentStatus;
  occupation?: string;
  employerName?: string;
  yearsInCurrentRole?: number;
  hasPensionDisabilityCoverage?: boolean;
  hasEmployerCoverage?: boolean;
};

export type IncomeSource = BaseEntity & {
  personId: string;
  type: "salary" | "self_employment" | "pension" | "rental" | "other";
  netMonthlyAmount: Money;
  /** Would this income reliably continue if the person died / became disabled? PRD §12.3, §13.1. */
  reliableIfDeceased: boolean;
  reliableIfDisabled: boolean;
};

export type ExpenseCategory =
  | "housing"
  | "food"
  | "transportation"
  | "childcare"
  | "education"
  | "healthcare"
  | "debt_service"
  | "discretionary"
  | "other";

export type Expense = BaseEntity & {
  householdId: string;
  category: ExpenseCategory;
  monthlyAmount: Money;
  /** Would this expense stop/shrink if the household lost a member? Needed for §12.3 survivor spend. */
  essential: boolean;
};

export type AssetType = "cash" | "investment" | "pension_fund" | "real_estate" | "other";

export type Asset = BaseEntity & {
  householdId: string;
  type: AssetType;
  value: Money;
  /** PRD §12.2 EarmarkedLiquidAssets / EarmarkedOtherAssets — has the client set this aside for protection? */
  earmarkedForProtection: boolean;
};

export type LiabilityType = "mortgage" | "consumer_loan" | "credit_line" | "other";

export type Liability = BaseEntity & {
  householdId: string;
  type: LiabilityType;
  balance: Money;
};

/** PRD §12.5 — mortgage needs the lender-beneficiary distinction called out explicitly. */
export type Mortgage = BaseEntity & {
  liabilityId: string;
  balance: Money;
  monthlyPayment: Money;
  targetPayoffDate?: string;
  /** True when an existing mortgage-life policy names the lender, not the family, as beneficiary. */
  hasLenderBeneficiaryCoverage: boolean;
  lenderBeneficiaryCoverageAmount?: Money;
};

export type Goal = BaseEntity & {
  householdId: string;
  type: "education_reserve" | "emergency_reserve" | "estate" | "other";
  description?: string;
  targetAmount?: Money;
  targetDate?: string;
};
