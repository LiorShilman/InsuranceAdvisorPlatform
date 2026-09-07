import { describe, expect, it } from "vitest";
import { ALL_HEALTH_COVERAGE_MODULES } from "@insurance-advisor/domain";
import { STARTER_ENGINE_CONFIG } from "@insurance-advisor/config";
import { HealthModuleAssessor } from "./health-module-assessor.js";

const assessor = new HealthModuleAssessor();

describe("HealthModuleAssessor (PRD §15)", () => {
  it("1. every module in ALL_HEALTH_COVERAGE_MODULES gets exactly one assessment, in order", () => {
    const { moduleAssessments } = assessor.assess({ modules: [] }, STARTER_ENGINE_CONFIG);
    expect(moduleAssessments.map((a) => a.module)).toEqual([...ALL_HEALTH_COVERAGE_MODULES]);
  });

  it("2. a module never asked about is treated as unknown, not false — flagged, not silently assumed absent", () => {
    const { moduleAssessments, confidence } = assessor.assess({ modules: [] }, STARTER_ENGINE_CONFIG);
    expect(moduleAssessments.every((a) => a.existing === "unknown")).toBe(true);
    expect(moduleAssessments.every((a) => a.need === "medium")).toBe(true);
    expect(moduleAssessments.every((a) => a.reasonCodes.includes("HEALTH_MODULE_UNKNOWN"))).toBe(true);
    expect(confidence).toBe("low");
  });

  it("3. existing:true modules are not_applicable and carry no unknown reason code", () => {
    const { moduleAssessments } = assessor.assess(
      { modules: ALL_HEALTH_COVERAGE_MODULES.map((module) => ({ module, existing: true as const })) },
      STARTER_ENGINE_CONFIG,
    );
    expect(moduleAssessments.every((a) => a.need === "not_applicable")).toBe(true);
    expect(moduleAssessments.every((a) => a.reasonCodes.length === 0)).toBe(true);
  });

  it("4. existing:false modules fall back to the configured default need level (not hard-coded)", () => {
    const { moduleAssessments } = assessor.assess(
      { modules: [{ module: "surgeries_abroad", existing: false }] },
      STARTER_ENGINE_CONFIG,
    );
    const assessment = moduleAssessments.find((a) => a.module === "surgeries_abroad");
    expect(assessment?.need).toBe(STARTER_ENGINE_CONFIG.healthModuleDefaultNeedWhenMissing.surgeries_abroad);
  });

  it("5. overlapsWithOtherPolicy flags duplicateRisk and the reason code regardless of existing status", () => {
    const { moduleAssessments } = assessor.assess(
      { modules: [{ module: "ambulatory", existing: true, overlapsWithOtherPolicy: true }] },
      STARTER_ENGINE_CONFIG,
    );
    const assessment = moduleAssessments.find((a) => a.module === "ambulatory");
    expect(assessment?.duplicateRisk).toBe(true);
    expect(assessment?.reasonCodes).toContain("HEALTH_DUPLICATE_POSSIBLE");
  });

  it("6. confidence is medium when only some modules are known", () => {
    const { confidence } = assessor.assess(
      { modules: [{ module: "surgeries_israel", existing: true }] },
      STARTER_ENGINE_CONFIG,
    );
    expect(confidence).toBe("medium");
  });

  it("7. confidence is high once every module has an explicit true/false answer", () => {
    const { confidence } = assessor.assess(
      { modules: ALL_HEALTH_COVERAGE_MODULES.map((module) => ({ module, existing: false as const })) },
      STARTER_ENGINE_CONFIG,
    );
    expect(confidence).toBe("high");
  });
});
