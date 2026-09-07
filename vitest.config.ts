import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Alias package specifiers straight to source so tests run against
 * TypeScript directly without requiring a prior `tsc -b` build step.
 * Mirrors the workspace dependency graph in docs/DECISIONS.md.
 */
function pkg(name: string): string {
  return fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));
}

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@insurance-advisor/shared": pkg("shared"),
      "@insurance-advisor/rules": pkg("rules"),
      "@insurance-advisor/domain": pkg("domain"),
      "@insurance-advisor/config": pkg("config"),
      "@insurance-advisor/questionnaire": pkg("questionnaire"),
      "@insurance-advisor/calculators": pkg("calculators"),
      "@insurance-advisor/test-fixtures": pkg("test-fixtures"),
    },
  },
});
