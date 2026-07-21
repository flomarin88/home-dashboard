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

/**
 * Every module specifier a file imports — static `... from "x"` / `export ...
 * from "x"` AND dynamic `import("x")`. Matching the specifier (not a `from`
 * literal) means a dynamic import, a deeper relative path (`../../hakit`), or an
 * alias can't slip a cross-seam import past the guard.
 */
function importedSpecifiers(src: string): string[] {
  const specs: string[] = [];
  const re =
    /(?:import|export)[^;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) specs.push(m[1] ?? m[2]);
  return specs;
}

/** Any path resolving to the `hakit` seam, at any relative depth or via alias. */
const HAKIT_REF = /(?:^|\/)hakit(?:\/|$)|^@hakit(?:\/|$)/;
/** Any path resolving to the `nutriclaude` seam, or the raw Supabase SDK. */
const NUTRI_REF = /(?:^|\/)nutriclaude(?:\/|$)/;
const SUPABASE_REF = /^@supabase(?:\/|$)/;

function tsFilesUnder(dir: string): string[] {
  return filesUnder(dir).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
}

describe("state-layer isolation (AD-2/AD-12)", () => {
  it("no file under src/nutriclaude imports from the hakit seam", () => {
    const offenders = tsFilesUnder(NUTRI_DIR).filter((f) =>
      importedSpecifiers(readFileSync(f, "utf8")).some((s) =>
        HAKIT_REF.test(s),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("no file under src/hakit imports from the nutriclaude seam or @supabase", () => {
    const offenders = tsFilesUnder(HAKIT_DIR).filter((f) =>
      importedSpecifiers(readFileSync(f, "utf8")).some(
        (s) => NUTRI_REF.test(s) || SUPABASE_REF.test(s),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
