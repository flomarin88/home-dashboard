import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * AD-2 (2nd exception) / AD-12: the NutriClaude seam and the HA seam stay
 * strictly isolated — no shared store, no cross-imports either way. This test
 * fails the build if a file under one seam imports from the other.
 */
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

const NUTRI_DIR = join(__dirname);
const HAKIT_DIR = join(__dirname, "..", "hakit");

describe("state-layer isolation (AD-2/AD-12)", () => {
  it("no file under src/nutriclaude imports from hakit or @hakit", () => {
    const offenders = filesUnder(NUTRI_DIR)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        return /from\s+["'](?:\.\.\/hakit|@hakit)/.test(src);
      });
    expect(offenders).toEqual([]);
  });

  it("no file under src/hakit imports from nutriclaude or @supabase", () => {
    const offenders = filesUnder(HAKIT_DIR)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        return /from\s+["'](?:\.\.\/nutriclaude|@supabase)/.test(src);
      });
    expect(offenders).toEqual([]);
  });
});
