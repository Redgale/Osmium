import assert from "node:assert/strict";
import test from "node:test";
import {
  auditOsmiumSource,
  buildOsmiumSource,
  extractProgramName,
  looksLikeNativeProgram,
  normalizeProgramName,
  validateCatalog,
} from "../lib/osmium";
// The vendored Emscripten module is JavaScript-only.
// @ts-expect-error no TypeScript declarations are supplied upstream
import TIVarsLib from "../public/vendor/TIVarsLib.js";
import ticalcUsb from "ticalc-usb";

const entries = [
  { id: "1", programName: "GAME1", title: "Game One", category: "Games" },
  { id: "2", programName: "TOOL2", title: "Tool Two", category: "Tools" },
];

test("normalizes calculator names", () => {
  assert.equal(normalizeProgramName("my-game!"), "MYGAME");
});

test("builds a dispatchable TI-BASIC launcher", () => {
  const build = buildOsmiumSource(entries);
  assert.equal(build.pages.length, 2);
  assert.match(build.source, /prgmGAME1/);
  assert.match(build.source, /prgmTOOL2/);
  assert.match(build.source, /Lbl MN/);
  assert.match(build.source, /getKey→K/);
  assert.match(build.source, /BackgroundOn DARKGRAY/);
  assert.match(build.source, /Full\nAxesOff\nGridOff/);
  assert.doesNotMatch(build.source, /Text\(4,278,/);
  assert.deepEqual(auditOsmiumSource(build.source), []);
  assert.match(build.source, /Lbl SE/);
  assert.match(build.source, /inString\("GAME ONE",Str9\)/);
});

test("repairs launcher state after a normally returning program", () => {
  const build = buildOsmiumSource(entries);
  assert.match(build.source, /prgmGAME1\n1→R\n1→P\n1→S\n0→D\nEnd/);
});

test("audits text bounds, tokenizer delimiters, labels, and unsafe jumps", () => {
  assert.ok(auditOsmiumSource('Text(4,278,"1/2")').some((error) => error.includes("column 278")));
  assert.ok(auditOsmiumSource("Pause").some((error) => error.includes("tokenizer delimiter")));
  assert.ok(
    auditOsmiumSource("If A=1\nThen\nGoto XX\nEnd\nLbl XX").some((error) =>
      error.includes("cannot leave a multiline Then"),
    ),
  );
  assert.ok(auditOsmiumSource("Goto ZZ").some((error) => error.includes("not defined")));
  assert.ok(
    auditOsmiumSource("If A=1\nIf B=1\nThen\nEnd").some((error) =>
      error.includes("not followed by Then"),
    ),
  );
});

test("passes the source audit across catalog sizes, themes, and feature combinations", () => {
  for (const size of [1, 6, 7, 24]) {
    const catalog = Array.from({ length: size }, (_, index) => ({
      id: String(index),
      programName: `G${String(index).padStart(7, "0")}`,
      title: `GAME ${index + 1}`,
      category: index % 2 ? "TOOLS" : "GAMES",
      favorite: index % 4 === 0,
    }));
    for (const theme of ["osmium", "ocean", "ember", "paper"] as const) {
      const build = buildOsmiumSource(catalog, "OSMIUM", {
        theme,
        enableFavorites: true,
        enableSearch: size % 2 === 0,
        enableRecent: size % 3 !== 0,
        showSplash: size % 2 !== 0,
        pin: size === 7 ? "1234" : "",
      });
      assert.deepEqual(auditOsmiumSource(build.source), []);
    }
  }
});

test("adds starred programs to a compile-time favorites page", () => {
  const build = buildOsmiumSource([{ ...entries[0], favorite: true }, entries[1]]);
  assert.equal(build.pages[0].category, "FAVORITES");
  assert.equal(build.pages[0].entries[0].programName, "GAME1");
  assert.equal(build.pages.length, 3);
});

test("respects optional feature and theme settings", () => {
  const build = buildOsmiumSource(entries, "OSMIUM", {
    theme: "ocean",
    enableSearch: false,
    showSplash: false,
    pin: "1234",
  });
  assert.match(build.source, /BackgroundOn NAVY/);
  assert.match(build.source, /OSMIUM PIN/);
  assert.doesNotMatch(build.source, /Lbl SE/);
});

test("rejects duplicate names and launcher collisions", () => {
  assert.ok(validateCatalog([...entries, { ...entries[0], id: "3" }]).some((message) => message.includes("more than once")));
  assert.ok(validateCatalog([{ ...entries[0], programName: "OSMIUM" }]).some((message) => message.includes("conflicts")));
});

test("reads a program name from a TI variable header", () => {
  const bytes = new Uint8Array(80);
  bytes.set(new TextEncoder().encode("**TI83F*"), 0);
  bytes[59] = 0x05;
  bytes.set(new TextEncoder().encode("HELLO"), 60);
  assert.equal(extractProgramName(bytes), "HELLO");
});

test("tokenizes and reopens the generated TI-BASIC program", async () => {
  const lib = await TIVarsLib();
  const build = buildOsmiumSource(entries);
  const program = lib.TIVarFile.createNew("Program", "OSMIUM", "84+CE");
  program.setContentFromString(build.source);
  const path = program.saveVarToFile("", "OSMIUM");
  const bytes = lib.FS.readFile(path, { encoding: "binary" });
  assert.equal(extractProgramName(bytes), "OSMIUM");
  const reopened = lib.TIVarFile.loadFromFile(path);
  const readable = reopened.getReadableContent();
  assert.match(readable, /prgmGAME1/);
  assert.match(readable, /prgmTOOL2/);
  assert.match(readable, /PURE TI-BASIC LAUNCHER/);
  assert.doesNotMatch(readable, /FnOff|PlotsOff/);
  assert.ok(bytes.byteLength < 65525);
  const metadataLength = bytes[55] | (bytes[56] << 8);
  const dataStart = 55 + 2 + metadataLength + 2;
  const tokenBytes = bytes.slice(dataStart + 2, bytes.length - 2);
  assert.equal([...tokenBytes].filter((byte) => byte === 0xd8).length, 2);
  const transferFile = ticalcUsb.tifiles.parseFile(bytes);
  assert.equal(ticalcUsb.tifiles.isValid(transferFile), true);
  assert.equal(transferFile.calcType, "TI-84 Plus");
  assert.equal(transferFile.entries[0].name, "OSMIUM");
  reopened.delete?.();
  program.delete?.();
});

test("detects a CE assembly program header", async () => {
  const lib = await TIVarsLib();
  const program = lib.TIVarFile.createNew("Program", "NATIVE", "84+CE");
  program.setContentFromString("Asm84CEPrgm:C9");
  const path = program.saveVarToFile("", "NATIVE");
  const bytes = lib.FS.readFile(path, { encoding: "binary" });
  const reopened = lib.TIVarFile.loadFromFile(path);
  assert.equal(looksLikeNativeProgram(bytes, reopened.getReadableContent()), true);
  reopened.delete?.();
  program.delete?.();
});
