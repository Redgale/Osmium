export type ProgramEntry = {
  id: string;
  programName: string;
  title: string;
  category: string;
  favorite?: boolean;
  sourceFile?: string;
};

export type ThemeKey = "osmium" | "ocean" | "ember" | "paper";

export type OsmiumOptions = {
  theme: ThemeKey;
  enableFavorites: boolean;
  enableSearch: boolean;
  enableRecent: boolean;
  showSplash: boolean;
  pin: string;
};

export type OsmiumPage = {
  category: string;
  entries: ProgramEntry[];
};

export type OsmiumBuild = {
  source: string;
  pages: OsmiumPage[];
  warnings: string[];
  features: string[];
};

export function auditOsmiumSource(source: string): string[] {
  const errors: string[] = [];
  const lines = source.split("\n");
  const labels = new Set<string>();
  const targets = new Set<string>();
  const blocks: Array<"then" | "loop"> = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const previousLine = lines[index - 1];
    const nextLine = lines[index + 1];
    const label = line.match(/^Lbl ([A-Z0-9]{1,2})$/)?.[1];
    if (label) {
      if (labels.has(label)) errors.push(`Line ${lineNumber}: duplicate label ${label}.`);
      labels.add(label);
    }
    for (const match of line.matchAll(/Goto ([A-Z0-9]{1,2})/g)) targets.add(match[1]);

    if (line.includes("Goto ") && blocks.includes("then")) {
      errors.push(`Line ${lineNumber}: Goto cannot leave a multiline Then block safely.`);
    }
    if (/:Then:.*Goto .*:End/.test(line)) {
      errors.push(`Line ${lineNumber}: inline Then block contains an unsafe Goto.`);
    }
    if (/^If /.test(line) && !line.includes(":") && nextLine !== "Then") {
      errors.push(`Line ${lineNumber}: multiline If is not followed by Then.`);
    }
    if (line === "Then" && !/^If /.test(previousLine ?? "")) {
      errors.push(`Line ${lineNumber}: Then is not paired with the preceding If.`);
    }

    if (["FnOff", "PlotsOff", "Pause", "Disp"].includes(line)) {
      errors.push(`Line ${lineNumber}: ${line} is missing the tokenizer delimiter.`);
    }

    const textCall = line.match(/^Text\(([^,]+),(\d+),/);
    if (textCall) {
      const rowExpression = textCall[1];
      const column = Number(textCall[2]);
      if (column < 0 || column > TEXT_MAX_COLUMN) {
        errors.push(`Line ${lineNumber}: Text column ${column} is outside 0-${TEXT_MAX_COLUMN}.`);
      }
      if (/^\d+$/.test(rowExpression)) {
        const row = Number(rowExpression);
        if (row < 0 || row > TEXT_MAX_ROW) {
          errors.push(`Line ${lineNumber}: Text row ${row} is outside 0-${TEXT_MAX_ROW}.`);
        }
      } else if (!/^30\+18[GS]$/.test(rowExpression)) {
        errors.push(`Line ${lineNumber}: Text row expression ${rowExpression} has no proven bound.`);
      }
    }

    if (/^For\(/.test(line) || /^Repeat /.test(line)) blocks.push("loop");
    if (line === "Then") blocks.push("then");
    if (line === "End") {
      if (!blocks.length) errors.push(`Line ${lineNumber}: unmatched End.`);
      else blocks.pop();
    }
  });

  if (blocks.length) errors.push("Generated source has an unclosed control block.");
  targets.forEach((target) => {
    if (!labels.has(target)) errors.push(`Goto target ${target} is not defined.`);
  });
  return errors;
}

export const DEFAULT_OPTIONS: OsmiumOptions = {
  theme: "osmium",
  enableFavorites: true,
  enableSearch: true,
  enableRecent: true,
  showSplash: true,
  pin: "",
};

export const THEMES: Record<ThemeKey, {
  label: string;
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  category: string;
  cssBackground: string;
  cssForeground: string;
  cssMuted: string;
  cssAccent: string;
  cssCategory: string;
}> = {
  osmium: {
    label: "Osmium dark",
    background: "DARKGRAY",
    foreground: "WHITE",
    muted: "LTGRAY",
    accent: "YELLOW",
    category: "LTBLUE",
    cssBackground: "#33393c",
    cssForeground: "#ffffff",
    cssMuted: "#c8ced0",
    cssAccent: "#f1ec55",
    cssCategory: "#7bd8f0",
  },
  ocean: {
    label: "Deep ocean",
    background: "NAVY",
    foreground: "WHITE",
    muted: "LTBLUE",
    accent: "YELLOW",
    category: "ORANGE",
    cssBackground: "#101c4d",
    cssForeground: "#ffffff",
    cssMuted: "#78c9f0",
    cssAccent: "#f4ed5c",
    cssCategory: "#f2a45d",
  },
  ember: {
    label: "Ember",
    background: "BLACK",
    foreground: "WHITE",
    muted: "LTGRAY",
    accent: "ORANGE",
    category: "RED",
    cssBackground: "#080808",
    cssForeground: "#ffffff",
    cssMuted: "#c9c9c9",
    cssAccent: "#ff9959",
    cssCategory: "#f35d61",
  },
  paper: {
    label: "Paper",
    background: "WHITE",
    foreground: "BLACK",
    muted: "GRAY",
    accent: "BLUE",
    category: "RED",
    cssBackground: "#f4f5ef",
    cssForeground: "#151918",
    cssMuted: "#66706d",
    cssAccent: "#285de2",
    cssCategory: "#c63f43",
  },
};

const NAME_PATTERN = /^[A-Z][A-Z0-9]{0,7}$/;
const MAX_ITEMS_PER_PAGE = 6;
const TEXT_MAX_ROW = 148;
const TEXT_MAX_COLUMN = 256;

export function normalizeProgramName(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function sanitizeDisplay(value: string, fallback: string): string {
  const cleaned = value
    .toUpperCase()
    .replace(/[\"→]/g, "")
    .replace(/[^ A-Z0-9.!?+\-*/()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, 21);
}

export function normalizePin(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function validateCatalog(
  entries: ProgramEntry[],
  launcherName = "OSMIUM",
  options: OsmiumOptions = DEFAULT_OPTIONS,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const normalizedLauncher = normalizeProgramName(launcherName);

  if (!NAME_PATTERN.test(normalizedLauncher)) {
    errors.push("The launcher name must start with a letter and use at most 8 letters or numbers.");
  }
  if (!entries.length) errors.push("Add at least one TI-BASIC program.");
  if (options.pin && !/^\d{1,6}$/.test(options.pin)) {
    errors.push("The optional PIN must contain 1 to 6 digits.");
  }

  entries.forEach((entry, index) => {
    const name = normalizeProgramName(entry.programName);
    if (!NAME_PATTERN.test(name)) {
      errors.push(`Entry ${index + 1} has an invalid calculator program name.`);
    }
    if (name === normalizedLauncher) errors.push(`${name} conflicts with the launcher name.`);
    if (seen.has(name)) errors.push(`${name} appears more than once.`);
    seen.add(name);
  });

  return errors;
}

function normalizeEntries(rawEntries: ProgramEntry[]) {
  return rawEntries.map((entry) => ({
    ...entry,
    programName: normalizeProgramName(entry.programName),
    title: sanitizeDisplay(entry.title, normalizeProgramName(entry.programName)),
    category: sanitizeDisplay(entry.category, "PROGRAMS"),
    favorite: Boolean(entry.favorite),
  }));
}

function splitPage(category: string, entries: ProgramEntry[]) {
  const pages: OsmiumPage[] = [];
  for (let index = 0; index < entries.length; index += MAX_ITEMS_PER_PAGE) {
    const slice = entries.slice(index, index + MAX_ITEMS_PER_PAGE);
    const suffix = entries.length > MAX_ITEMS_PER_PAGE
      ? ` ${Math.floor(index / MAX_ITEMS_PER_PAGE) + 1}`
      : "";
    pages.push({
      category: sanitizeDisplay(`${category}${suffix}`, "PROGRAMS").slice(0, 18),
      entries: slice,
    });
  }
  return pages;
}

function groupIntoPages(entries: ProgramEntry[], options: OsmiumOptions): OsmiumPage[] {
  const categories: Array<{ name: string; entries: ProgramEntry[] }> = [];
  const categoryIndex = new Map<string, number>();

  entries.forEach((entry) => {
    const category = sanitizeDisplay(entry.category, "PROGRAMS").slice(0, 18);
    let index = categoryIndex.get(category);
    if (index === undefined) {
      index = categories.length;
      categoryIndex.set(category, index);
      categories.push({ name: category, entries: [] });
    }
    categories[index].entries.push(entry);
  });

  const pages: OsmiumPage[] = [];
  const favorites = entries.filter((entry) => entry.favorite);
  if (options.enableFavorites && favorites.length) {
    pages.push(...splitPage("FAVORITES", favorites));
  }
  categories.forEach((category) => pages.push(...splitPage(category.name, category.entries)));
  return pages;
}

function quote(value: string) {
  return `\"${value}\"`;
}

function text(row: number | string, column: number, value: string, dynamic = false) {
  if (typeof row === "number" && (!Number.isInteger(row) || row < 0 || row > TEXT_MAX_ROW)) {
    throw new Error(`Text row ${row} is outside the full-screen range 0-${TEXT_MAX_ROW}.`);
  }
  if (!Number.isInteger(column) || column < 0 || column > TEXT_MAX_COLUMN) {
    throw new Error(`Text column ${column} is outside the full-screen range 0-${TEXT_MAX_COLUMN}.`);
  }
  return `Text(${row},${column},${dynamic ? value : quote(value)})`;
}

function rightAlignedColumn(value: string) {
  return Math.max(7, 256 - value.length * 6);
}

function color(value: string) {
  return `TextColor(${value})`;
}

function setupGraph(background: string) {
  return [
    "Full",
    "AxesOff",
    "GridOff",
    `BackgroundOn ${background}`,
    "ClrDraw",
  ];
}

function findPrimaryLocation(pages: OsmiumPage[], programName: string) {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const itemIndex = pages[pageIndex].entries.findIndex(
      (entry) => entry.programName === programName && pages[pageIndex].category !== "FAVORITES",
    );
    if (itemIndex >= 0) return { page: pageIndex + 1, selection: itemIndex + 1 };
  }
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const itemIndex = pages[pageIndex].entries.findIndex((entry) => entry.programName === programName);
    if (itemIndex >= 0) return { page: pageIndex + 1, selection: itemIndex + 1 };
  }
  return { page: 1, selection: 1 };
}

export function buildOsmiumSource(
  rawEntries: ProgramEntry[],
  launcherName = "OSMIUM",
  rawOptions: Partial<OsmiumOptions> = DEFAULT_OPTIONS,
): OsmiumBuild {
  const options = { ...DEFAULT_OPTIONS, ...rawOptions, pin: normalizePin(rawOptions.pin ?? "") };
  const entries = normalizeEntries(rawEntries);
  const errors = validateCatalog(entries, launcherName, options);
  if (errors.length) throw new Error(errors.join("\n"));

  const pages = groupIntoPages(entries, options);
  const theme = THEMES[options.theme] ?? THEMES.osmium;
  const warnings: string[] = [];
  if (entries.length > 30) {
    warnings.push("Large searchable catalogs can approach TI-BASIC size limits and redraw more slowly.");
  }
  const features = [
    "color interface",
    "safe return-state repair",
    "categories",
    ...(options.enableFavorites ? ["compile-time favorites"] : []),
    ...(options.enableSearch ? ["title and program search"] : []),
    ...(options.enableRecent ? ["session recent program"] : []),
    ...(options.pin ? ["startup PIN"] : []),
  ];

  const catalogId = new Map(entries.map((entry, index) => [entry.programName, index + 1]));
  const lines: string[] = [];

  if (options.pin) {
    lines.push(
      "ClrHome",
      `Input \"OSMIUM PIN:\",A`,
      `If A≠${options.pin}`,
      "Then",
      "ClrHome",
      "Disp \"ACCESS DENIED\"",
      "Stop",
      "End",
    );
  }

  lines.push("1→P", "1→S", "0→R", "0→D");
  if (options.showSplash) {
    lines.push(
      ...setupGraph(theme.background),
      color(theme.accent),
      text(55, 116, "OSMIUM"),
      color(theme.muted),
      text(78, 88, "PURE TI-BASIC SHELL"),
      "For(K,1,180)",
      "End",
    );
  }

  lines.push("Lbl MN", ...setupGraph(theme.background));
  lines.push(color(theme.foreground), text(4, 7, "OSMIUM"));

  pages.forEach((page, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const pageLabel = `${pageNumber}/${pages.length}`;
    lines.push(`If P=${pageNumber}`, "Then", `${page.entries.length}→N`);
    lines.push(color(theme.muted), text(4, rightAlignedColumn(pageLabel), pageLabel));
    lines.push(color(theme.category), text(24, 7, page.category));
    page.entries.forEach((entry, entryIndex) => {
      const y = 46 + entryIndex * 16;
      lines.push(color(theme.muted), text(y, 23, entry.title));
      lines.push(`If S=${entryIndex + 1}`, "Then", color(theme.accent), text(y, 8, ">"), text(y, 23, entry.title), "End");
    });
    lines.push("End");
  });

  lines.push(
    color(theme.muted),
    text(148, 7, options.enableSearch ? "ALPHA SEARCH   MODE INFO" : "MODE INFO"),
    "Lbl KY",
    "0→K",
    "Repeat K",
    "getKey→K",
    "End",
    "If K=45:Goto QT",
    "If K=22:Goto ST",
  );
  if (options.enableSearch) lines.push("If K=31:Goto SE");
  lines.push(
    "If K=105 or K=21:Goto EX",
    "If K=25 and S>1",
    "Then",
    "S-1→S",
    "End",
    "If K=25:Goto MN",
    "If K=34 and S<N",
    "Then",
    "S+1→S",
    "End",
    "If K=34:Goto MN",
    "If K=24",
    "Then",
    "P-1→P",
    `If P=0:${pages.length}→P`,
    "1→S",
    "End",
    "If K=24:Goto MN",
    "If K=26",
    "Then",
    "P+1→P",
    `If P>${pages.length}:1→P`,
    "1→S",
    "End",
    "If K=26:Goto MN",
    "Goto KY",
    "Lbl EX",
    "0→D",
  );

  pages.forEach((page, pageIndex) => {
    page.entries.forEach((entry, entryIndex) => {
      lines.push(`If P=${pageIndex + 1} and S=${entryIndex + 1}:${catalogId.get(entry.programName)}→D`);
    });
  });
  lines.push("Goto DX");

  lines.push("Lbl DX");
  entries.forEach((entry, index) => {
    const id = index + 1;
    const location = findPrimaryLocation(pages, entry.programName);
    lines.push(
      `If D=${id}`,
      "Then",
      "BackgroundOff",
      "ClrHome",
      `prgm${entry.programName}`,
      `${id}→R`,
      `${location.page}→P`,
      `${location.selection}→S`,
      "0→D",
      "End",
    );
  });
  lines.push("Goto MN");

  if (options.enableSearch) {
    lines.push(
      "Lbl SE",
      "BackgroundOff",
      "ClrHome",
      "Disp \"USE QUOTED UPPERCASE\"",
      `Input \"SEARCH:\",Str9`,
      "0→G",
      "0→dim(L6)",
      ...setupGraph(theme.background),
      color(theme.foreground),
      text(4, 7, "SEARCH RESULTS"),
      color(theme.muted),
    );
    entries.forEach((entry, index) => {
      const id = index + 1;
      lines.push(
        `If (inString(${quote(entry.title)},Str9) or inString(${quote(entry.programName)},Str9)) and G<6`,
        "Then",
        "G+1→G",
        `${id}→L6(G)`,
        text("30+18G", 23, entry.title),
        "End",
      );
    });
    lines.push(
      "If G=0",
      "Then",
      color(theme.category),
      text(70, 70, "NO MATCHES - PRESS A KEY"),
      "Pause ",
      "End",
      "If G=0:Goto MN",
      "1→S",
      "Lbl SK",
      color(theme.accent),
      text("30+18S", 8, ">"),
      "0→D",
      "0→K",
      "Repeat K",
      "getKey→K",
      "End",
      "If K=45:Goto MN",
      "If K=105 or K=21:L6(S)→D",
      "If D>0:Goto DX",
      "If K=25 and S>1",
      "Then",
      color(theme.background),
      text("30+18S", 8, ">"),
      "S-1→S",
      "End",
      "If K=34 and S<G",
      "Then",
      color(theme.background),
      text("30+18S", 8, ">"),
      "S+1→S",
      "End",
      "Goto SK",
    );
  }

  lines.push(
    "Lbl ST",
    "0→D",
    ...setupGraph(theme.background),
    color(theme.foreground),
    text(4, 7, "OSMIUM INFO"),
    color(theme.category),
    text(30, 7, `${entries.length} PROGRAM${entries.length === 1 ? "" : "S"} / ${pages.length} PAGES`),
    color(theme.muted),
    text(54, 7, options.enableSearch ? "ALPHA  SEARCH" : "SEARCH  DISABLED"),
    text(72, 7, `${entries.filter((entry) => entry.favorite).length} COMPILED FAVORITES`),
  );
  if (options.enableRecent) {
    lines.push(text(96, 7, "ENTER  RUN RECENT"), "If R=0", "Then", color(theme.category), text(116, 7, "NO RECENT PROGRAM"), "End");
    entries.forEach((entry, index) => {
      lines.push(`If R=${index + 1}:Then:${color(theme.accent)}:${text(116, 7, entry.title)}:End`);
    });
  } else {
    lines.push(text(96, 7, "RECENT  DISABLED"));
  }
  lines.push(
    color(theme.muted),
    text(148, 7, "CLEAR BACK   MODE ABOUT"),
    "0→K",
    "Repeat K",
    "getKey→K",
    "End",
    "If K=45:Goto MN",
    "If K=22:Goto AB",
  );
  if (options.enableSearch) lines.push("If K=31:Goto SE");
  if (options.enableRecent) {
    lines.push("If (K=105 or K=21) and R>0:R→D", "If D>0:Goto DX");
  }
  lines.push("Goto ST");

  lines.push(
    "Lbl AB",
    ...setupGraph(theme.background),
    color(theme.accent),
    text(14, 7, "OSMIUM"),
    color(theme.foreground),
    text(42, 7, "PURE TI-BASIC LAUNCHER"),
    color(theme.muted),
    text(66, 7, "OS 5.8.5 COMPATIBLE"),
    text(86, 7, "UP/DOWN SELECT"),
    text(104, 7, "LEFT/RIGHT PAGE"),
    text(122, 7, "ENTER/2ND LAUNCH"),
    color(theme.category),
    text(148, 7, "PRESS ANY KEY TO RETURN"),
    "Pause ",
    "Goto MN",
  );

  lines.push(
    "Lbl QT",
    "BackgroundOff",
    "TextColor(BLACK)",
    "AxesOn",
    "GridOff",
    "ClrDraw",
    "ClrHome",
    "Stop",
  );

  const source = lines.join("\n");
  const auditErrors = auditOsmiumSource(source);
  if (auditErrors.length) {
    throw new Error(`Generated TI-BASIC safety audit failed:\n${auditErrors.join("\n")}`);
  }
  return { source, pages, warnings, features };
}

export function extractProgramName(bytes: Uint8Array): string {
  if (bytes.length < 74) throw new Error("This file is too small to be a TI variable file.");
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 8));
  if (signature !== "**TI83F*") throw new Error("This is not a supported TI-83/84 variable file.");
  const type = bytes[59];
  if (type !== 0x05 && type !== 0x06) {
    throw new Error("Only TI program (.8xp) variables can be added.");
  }
  const name = new TextDecoder("ascii")
    .decode(bytes.slice(60, 68))
    .replace(/\0/g, "")
    .trim();
  if (!NAME_PATTERN.test(name)) throw new Error("The calculator program name is invalid.");
  return name;
}

export function looksLikeNativeProgram(bytes: Uint8Array, readableSource: string): boolean {
  const metadataLength = bytes[55] | (bytes[56] << 8);
  const dataStart = 55 + 2 + metadataLength + 2;
  const first = bytes[dataStart + 2];
  const second = bytes[dataStart + 3];
  const normalized = readableSource.trimStart();
  return (
    (first === 0xef && second === 0x7b) ||
    /^(Asm84CEPrgm|AsmPrgm|AsmComp\()/i.test(normalized)
  );
}
