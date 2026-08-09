import fs from "node:fs";
import path from "node:path";
import TIVarsLib from "../public/vendor/TIVarsLib.js";
import { buildOsmiumSource } from "../lib/osmium";

const root = path.resolve(import.meta.dirname, "..");
const outputDirectory = path.join(root, "calculator-demo");
fs.mkdirSync(outputDirectory, { recursive: true });

const lib = await TIVarsLib();

function writeProgram(name: string, source: string) {
  const program = lib.TIVarFile.createNew("Program", name, "84+CE");
  program.setContentFromString(source);
  const virtualPath = program.saveVarToFile("", name);
  const bytes = lib.FS.readFile(virtualPath, { encoding: "binary" });
  fs.writeFileSync(path.join(outputDirectory, `${name}.8xp`), bytes);
  fs.writeFileSync(path.join(outputDirectory, `${name}-source.txt`), `${source}\n`);
  program.delete?.();
  lib.FS.unlink(virtualPath);
}

const demoProgram = [
  "ClrHome",
  "Disp \"OSMIUM DEMO\"",
  "Disp \"PURE TI-BASIC\"",
  "Disp \"RETURN REPAIR READY\"",
  "Pause ",
].join("\n");

const launcher = buildOsmiumSource(
  [{
    id: "demo",
    programName: "OSMDEMO",
    title: "OSMIUM DEMO",
    category: "DEMOS",
    favorite: true,
  }],
  "OSMIUM",
  { theme: "osmium", pin: "" },
).source;

writeProgram("OSMIUM", launcher);
writeProgram("OSMDEMO", demoProgram);

fs.writeFileSync(
  path.join(outputDirectory, "README.txt"),
  [
    "OSMIUM v0.3.2 CALCULATOR DEMO",
    "============================",
    "",
    "Transfer both OSMIUM.8xp and OSMDEMO.8xp with TI Connect CE.",
    "On the calculator, press PRGM and run OSMIUM.",
    "",
    "Controls:",
    "  arrows       navigate the launcher",
    "  ENTER / 2nd  launch the selected program",
    "  ALPHA        search (enter an uppercase quoted string)",
    "  MODE         information, recent program, and About",
    "  CLEAR        go back or exit",
    "",
    "The demo returns normally so Osmium can reconstruct its interface.",
    "A game that executes Stop exits the complete TI-BASIC call stack.",
    "Both files are pure TI-BASIC and contain no assembly code.",
    "The accompanying source text files are included for inspection.",
    "",
  ].join("\n"),
);

console.log(`Built calculator demo in ${outputDirectory}`);
