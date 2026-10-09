/**
 * `vlo --help`, `vlo <verb> --help` and `vlo --version` — all on stdout with a zero exit,
 * and detected before a verb's strict `parseArgs` can reject the flag.
 */

import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.ts";

const PACKAGE_JSON = new URL("../package.json", import.meta.url);

function capture(): { stdout: () => string; stderr: () => string } {
  const out: string[] = [];
  const err: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    out.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    err.push(String(chunk));
    return true;
  });
  return { stdout: () => out.join(""), stderr: () => err.join("") };
}

let exitCodeBefore: typeof process.exitCode;

afterEach(() => {
  process.exitCode = exitCodeBefore;
  vi.restoreAllMocks();
});

describe("vlo --help", () => {
  it.each([[[]], [["--help"]], [["-h"]], [["help"]]])("%j prints every verb on stdout", async (argv) => {
    exitCodeBefore = process.exitCode;
    const io = capture();
    await main(argv);

    expect(process.exitCode).toBe(exitCodeBefore);
    expect(io.stderr()).toBe("");
    for (const verb of ["vlo dev", "vlo serve", "vlo doctor", "vlo deploy"]) {
      expect(io.stdout()).toContain(verb);
    }
  });

  it.each(["dev", "serve", "doctor", "deploy"])("vlo %s --help prints only that verb", async (verb) => {
    exitCodeBefore = process.exitCode;
    for (const flag of ["--help", "-h"]) {
      const io = capture();
      await main([verb, flag]);

      expect(process.exitCode).toBe(exitCodeBefore);
      expect(io.stderr()).toBe("");
      expect(io.stdout().trim().split("\n")).toHaveLength(1);
      expect(io.stdout()).toMatch(new RegExp(`^vlo ${verb} `));
      vi.restoreAllMocks();
    }
  });

  it("still sends an unknown verb to stderr with exit 1", async () => {
    exitCodeBefore = process.exitCode;
    const io = capture();
    await main(["frobnicate"]);

    expect(process.exitCode).toBe(1);
    expect(io.stdout()).toBe("");
    expect(io.stderr()).toContain("vlo dev");
  });
});

describe("vlo --version", () => {
  it.each(["--version", "-v"])("%s prints the package version", async (flag) => {
    exitCodeBefore = process.exitCode;
    const { version } = JSON.parse(await readFile(PACKAGE_JSON, "utf8")) as { version: string };
    const io = capture();
    await main([flag]);

    expect(process.exitCode).toBe(exitCodeBefore);
    expect(io.stdout()).toBe(`${version}\n`);
  });
});
