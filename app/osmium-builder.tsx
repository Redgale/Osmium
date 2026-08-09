"use client";

import {
  CSSProperties,
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildOsmiumSource,
  DEFAULT_OPTIONS,
  extractProgramName,
  looksLikeNativeProgram,
  normalizePin,
  normalizeProgramName,
  OsmiumOptions,
  ProgramEntry,
  sanitizeDisplay,
  THEMES,
  ThemeKey,
  validateCatalog,
} from "../lib/osmium";
import type { TICalculator, TIFile } from "ticalc-usb";

type TIVarsModule = {
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string, options?: { encoding?: string }): Uint8Array;
    unlink(path: string): void;
  };
  TIVarFile: {
    loadFromFile(path: string): { getReadableContent(): string; delete?: () => void };
    createNew(type: string, name: string, model: string): {
      setContentFromString(source: string): void;
      saveVarToFile(directory: string, name: string): string;
      delete?: () => void;
    };
  };
};

type TicalcUsbApi = {
  ticalc: {
    browserSupported(): boolean;
    init(options?: { supportLevel?: string }): Promise<void>;
    choose(options?: { supportLevel?: string }): Promise<void>;
    addEventListener(
      event: "connect" | "disconnect",
      handler: (calculator: TICalculator) => void,
    ): void;
  };
  tifiles: {
    parseFile(bytes: Uint8Array): TIFile;
    isValid(file: TIFile): boolean;
  };
};

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function downloadFile(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OsmiumBuilder() {
  const [entries, setEntries] = useState<ProgramEntry[]>([]);
  const [launcherName, setLauncherName] = useState("OSMIUM");
  const [options, setOptions] = useState<OsmiumOptions>(DEFAULT_OPTIONS);
  const [module, setModule] = useState<TIVarsModule | null>(null);
  const [engineStatus, setEngineStatus] = useState("Loading TI file engine…");
  const [notice, setNotice] = useState("Add your TI-BASIC programs to begin.");
  const [dragging, setDragging] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewSelection, setPreviewSelection] = useState(0);
  const [gameFiles, setGameFiles] = useState<Record<string, Uint8Array>>({});
  const [selectedTransfers, setSelectedTransfers] = useState<Record<string, boolean>>({});
  const [usbSupported, setUsbSupported] = useState<boolean | null>(null);
  const [usbStatus, setUsbStatus] = useState("Checking browser USB support…");
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferTotal, setTransferTotal] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const usbApi = useRef<TicalcUsbApi | null>(null);
  const calculator = useRef<TICalculator | null>(null);

  useEffect(() => {
    let active = true;
    const importModule = new Function("path", "return import(path)") as (
      path: string,
    ) => Promise<{ default: () => Promise<TIVarsModule> }>;
    importModule("/vendor/TIVarsLib.js")
      .then((factory) => factory.default())
      .then((loaded) => {
        if (!active) return;
        setModule(loaded);
        setEngineStatus("TI file engine ready");
      })
      .catch((error) => {
        console.error(error);
        if (active) setEngineStatus("TI file engine failed to load");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    import("ticalc-usb")
      .then(async (loaded) => {
        const candidate = loaded as unknown as TicalcUsbApi & { default?: TicalcUsbApi };
        const api = candidate.default?.ticalc ? candidate.default : candidate;
        if (!active) return;
        usbApi.current = api;
        if (!api.ticalc.browserSupported()) {
          setUsbSupported(false);
          setUsbStatus("WebUSB is unavailable in this browser. Use Chrome, Edge, or Chromium.");
          return;
        }

        setUsbSupported(true);
        setUsbStatus("USB ready — a send button will open the calculator chooser.");
        api.ticalc.addEventListener("connect", (connected) => {
          calculator.current = connected;
          if (active) setUsbStatus(`${connected.name} connected`);
        });
        api.ticalc.addEventListener("disconnect", (disconnected) => {
          if (calculator.current !== disconnected) return;
          calculator.current = null;
          if (active) setUsbStatus("Calculator disconnected");
        });
        try {
          await api.ticalc.init({ supportLevel: "none" });
        } catch (error) {
          console.error(error);
          if (active) setUsbStatus("USB initialized, but no calculator is connected yet.");
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setUsbSupported(false);
          setUsbStatus("The calculator USB transfer engine could not load.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const build = useMemo(() => {
    try {
      return buildOsmiumSource(entries, launcherName, options);
    } catch {
      return null;
    }
  }, [entries, launcherName, options]);
  const errors = useMemo(
    () => validateCatalog(entries, launcherName, options),
    [entries, launcherName, options],
  );
  const pages = build?.pages ?? [];
  const safePreviewPage = Math.min(previewPage, Math.max(0, pages.length - 1));
  const currentPage = pages[safePreviewPage];
  const safePreviewSelection = Math.min(
    previewSelection,
    Math.max(0, (currentPage?.entries.length ?? 1) - 1),
  );
  const theme = THEMES[options.theme];
  const previewStyle = {
    "--screen-bg": theme.cssBackground,
    "--screen-fg": theme.cssForeground,
    "--screen-muted": theme.cssMuted,
    "--screen-accent": theme.cssAccent,
    "--screen-category": theme.cssCategory,
  } as CSSProperties;
  const loadedTransferCount = Object.keys(gameFiles).length;
  const selectedGameEntries = entries.filter(
    (entry) => gameFiles[entry.id] && selectedTransfers[entry.id],
  );

  function setOption<K extends keyof OsmiumOptions>(key: K, value: OsmiumOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  async function addFiles(files: FileList | File[]) {
    if (!module) {
      setNotice("Wait for the TI file engine to finish loading.");
      return;
    }

    const additions: ProgramEntry[] = [];
    const loadedFiles: Array<{ id: string; bytes: Uint8Array; sourceFile: string }> = [];
    const knownPrograms = new Map(
      entries.map((entry) => [normalizeProgramName(entry.programName), entry]),
    );
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      let parsed: { delete?: () => void } | null = null;
      const path = `/upload-${makeId()}.8xp`;
      try {
        if (!file.name.toLowerCase().endsWith(".8xp")) throw new Error("not an .8xp file");
        const bytes = new Uint8Array(await file.arrayBuffer());
        const programName = extractProgramName(bytes);
        module.FS.writeFile(path, bytes);
        parsed = module.TIVarFile.loadFromFile(path);
        const source = parsed.getReadableContent();
        if (looksLikeNativeProgram(bytes, source)) {
          throw new Error("assembly/C programs cannot run on OS 5.8.5");
        }
        let entry = knownPrograms.get(programName);
        if (!entry) {
          entry = {
            id: makeId(),
            programName,
            title: sanitizeDisplay(programName, programName),
            category: "GAMES",
            favorite: false,
            sourceFile: file.name,
          };
          additions.push(entry);
          knownPrograms.set(programName, entry);
        }
        loadedFiles.push({ id: entry.id, bytes, sourceFile: file.name });
      } catch (error) {
        rejected.push(`${file.name}: ${error instanceof Error ? error.message : "could not be read"}`);
      } finally {
        parsed?.delete?.();
        try {
          module.FS.unlink(path);
        } catch {
          // The temporary file was never written or was already removed.
        }
      }
    }

    if (loadedFiles.length) {
      const sourceFiles = new Map(loadedFiles.map((item) => [item.id, item.sourceFile]));
      setEntries((current) => [
        ...current.map((entry) =>
          sourceFiles.has(entry.id)
            ? { ...entry, sourceFile: sourceFiles.get(entry.id) }
            : entry,
        ),
        ...additions,
      ]);
      setGameFiles((current) => {
        const next = { ...current };
        loadedFiles.forEach((item) => {
          next[item.id] = item.bytes;
        });
        return next;
      });
      setSelectedTransfers((current) => {
        const next = { ...current };
        loadedFiles.forEach((item) => {
          next[item.id] = true;
        });
        return next;
      });
    }
    setNotice(
      [
        loadedFiles.length
          ? `Loaded ${loadedFiles.length} transferable TI-BASIC file${loadedFiles.length === 1 ? "" : "s"}; ${additions.length} added to the catalog.`
          : "",
        rejected.length ? `Rejected ${rejected.length}: ${rejected.join(" · ")}` : "",
      ]
        .filter(Boolean)
        .join(" ") || "No programs were added.",
    );
  }

  function updateEntry(id: string, changes: Partial<ProgramEntry>) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)),
    );
  }

  function moveEntry(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= entries.length) return;
    setEntries((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function addManual() {
    setEntries((current) => [
      ...current,
      {
        id: makeId(),
        programName: "NEWPRGM",
        title: "NEW PROGRAM",
        category: "GAMES",
        favorite: false,
      },
    ]);
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    setGameFiles((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setSelectedTransfers((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function clearCatalog() {
    setEntries([]);
    setGameFiles({});
    setSelectedTransfers({});
  }

  function selectAllLoaded(selected: boolean) {
    setSelectedTransfers((current) => {
      const next = { ...current };
      Object.keys(gameFiles).forEach((id) => {
        next[id] = selected;
      });
      return next;
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void addFiles(event.dataTransfer.files);
  }

  function buildLauncherBytes() {
    if (!module || !build || errors.length) {
      throw new Error("Finish the catalog and wait for the TI file engine first.");
    }
    let program: { delete?: () => void } | null = null;
    let path = "";
    try {
      const name = normalizeProgramName(launcherName);
      program = module.TIVarFile.createNew("Program", name, "84+CE");
      program.setContentFromString(build.source);
      path = program.saveVarToFile("", name);
      const bytes = new Uint8Array(module.FS.readFile(path, { encoding: "binary" }));
      if (bytes.byteLength > 65525) {
        throw new Error("The generated launcher exceeds the calculator program size limit.");
      }
      return { bytes, name };
    } finally {
      program?.delete?.();
      if (path) {
        try {
          module.FS.unlink(path);
        } catch {
          // Already removed.
        }
      }
    }
  }

  async function compile() {
    try {
      const { bytes, name } = buildLauncherBytes();
      downloadFile(`${name}.8xp`, bytes, "application/octet-stream");
      setNotice(
        `Built ${name}.8xp — ${entries.length} programs, ${pages.length} pages, ${bytes.byteLength} bytes.`,
      );
    } catch (error) {
      setNotice(`Build failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  async function ensureCalculator() {
    const api = usbApi.current;
    if (!api || !usbSupported) {
      throw new Error("WebUSB is unavailable. Open Osmium in Chrome, Edge, or Chromium.");
    }
    if (!calculator.current) {
      setUsbStatus("Choose your calculator in the browser dialog…");
      await api.ticalc.choose({ supportLevel: "none" });
    }
    const connected = calculator.current;
    if (!connected) throw new Error("No calculator was selected.");
    setUsbStatus(`Checking ${connected.name}…`);
    if (!(await connected.isReady())) {
      calculator.current = null;
      throw new Error("The calculator is connected but is not responding.");
    }
    return connected;
  }

  async function sendFiles(files: Array<{ label: string; bytes: Uint8Array }>) {
    const api = usbApi.current;
    if (!api) throw new Error("The USB transfer engine is still loading.");
    setTransferBusy(true);
    setTransferProgress(0);
    setTransferTotal(files.length);
    try {
      const connected = await ensureCalculator();
      for (let index = 0; index < files.length; index += 1) {
        const item = files[index];
        setUsbStatus(`Sending ${item.label} (${index + 1}/${files.length})…`);
        const parsed = api.tifiles.parseFile(item.bytes);
        if (!api.tifiles.isValid(parsed)) {
          throw new Error(`${item.label} is not a valid calculator file.`);
        }
        if (!connected.canReceive(parsed)) {
          throw new Error(`${item.label} is not compatible with ${connected.name}.`);
        }
        const storage = await connected.getStorageDetails(parsed);
        if (!storage.fits) {
          throw new Error(`${connected.name} does not have enough free memory for ${item.label}.`);
        }
        await connected.sendFile(parsed);
        setTransferProgress(index + 1);
      }
      setUsbStatus(`Sent ${files.length} file${files.length === 1 ? "" : "s"} to ${connected.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUsbStatus(`Transfer stopped: ${message}`);
      throw error;
    } finally {
      setTransferBusy(false);
    }
  }

  async function sendSelectedGames() {
    if (!selectedGameEntries.length) {
      setUsbStatus("Check at least one uploaded game in the catalog first.");
      return;
    }
    try {
      await sendFiles(
        selectedGameEntries.map((entry) => ({
          label: entry.programName,
          bytes: gameFiles[entry.id],
        })),
      );
    } catch {
      // sendFiles already reports the actionable transfer error.
    }
  }

  async function sendOsmium() {
    try {
      const { bytes, name } = buildLauncherBytes();
      await sendFiles([{ label: name, bytes }]);
    } catch (error) {
      if (!transferBusy) {
        const message = error instanceof Error ? error.message : String(error);
        setUsbStatus(`Could not send Osmium: ${message}`);
      }
    }
  }

  function saveProject() {
    downloadFile(
      "osmium-project.json",
      JSON.stringify({ format: 2, launcherName, entries, options }, null, 2),
      "application/json",
    );
  }

  async function loadProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as {
        launcherName?: string;
        entries?: ProgramEntry[];
        options?: Partial<OsmiumOptions>;
      };
      if (!Array.isArray(parsed.entries)) throw new Error("missing catalog");
      setLauncherName(normalizeProgramName(parsed.launcherName ?? "OSMIUM"));
      setEntries(
        parsed.entries.map((entry) => ({
          ...entry,
          id: entry.id || makeId(),
          favorite: Boolean(entry.favorite),
        })),
      );
      setOptions({
        ...DEFAULT_OPTIONS,
        ...parsed.options,
        pin: normalizePin(parsed.options?.pin ?? ""),
      });
      setGameFiles({});
      setSelectedTransfers({});
      setNotice(
        `Loaded ${file.name}. The full catalog is ready; add only the .8xp files you want to send this session.`,
      );
    } catch {
      setNotice("That Osmium project file could not be loaded.");
    } finally {
      event.target.value = "";
    }
  }

  function previewMove(direction: "up" | "down" | "left" | "right") {
    if (!pages.length || !currentPage) return;
    if (direction === "up") setPreviewSelection((value) => Math.max(0, value - 1));
    if (direction === "down") {
      setPreviewSelection((value) => Math.min(currentPage.entries.length - 1, value + 1));
    }
    if (direction === "left") {
      setPreviewPage((value) => (value - 1 + pages.length) % pages.length);
      setPreviewSelection(0);
    }
    if (direction === "right") {
      setPreviewPage((value) => (value + 1) % pages.length);
      setPreviewSelection(0);
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Osmium home">
          <span className="atom-mark" aria-hidden="true"><i /><i /><i /><b /></span>
          <span>OSMIUM</span>
        </a>
        <div className="engine-state"><span />{engineStatus}</div>
        <a className="text-link" href="#features">Features</a>
        <a className="text-link" href="#transfer">USB transfer</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">PURE TI-BASIC · TI-84 PLUS CE</p>
          <h1>Build your own<br /><em>calculator launcher.</em></h1>
          <p className="lede">
            Add only the programs you want. Osmium compiles a custom color launcher with
            categories, favorites, search, recent-program access, and safe return handling.
          </p>
          <div className="hero-badges">
            <span>OS 5.8.5 compatible</span><span>Direct USB transfer</span><span>No uploads</span><span>No exploit required</span>
          </div>
        </div>

        <div className="calculator" aria-label="Interactive launcher preview">
          <div className="calc-top"><span>TI-84 Plus CE</span><span>PYTHON</span></div>
          <div className="screen-bezel">
            <div className="calc-screen color-screen" style={previewStyle}>
              <div className="screen-header"><strong>OSMIUM</strong><span>{pages.length ? safePreviewPage + 1 : 0}/{pages.length}</span></div>
              <div className="screen-category">{currentPage?.category ?? "CATALOG EMPTY"}</div>
              <div className="screen-list">
                {currentPage?.entries.map((entry, index) => (
                  <div className={index === safePreviewSelection ? "selected" : ""} key={`${entry.id}-${safePreviewPage}`}>
                    <span>{index === safePreviewSelection ? ">" : " "}</span>{entry.title}
                  </div>
                ))}
                {!currentPage && <div className="empty-preview">ADD PROGRAMS<br />TO BUILD OSMIUM</div>}
              </div>
              <div className="screen-footer">
                {options.enableSearch && <>ALPHA SEARCH&nbsp;&nbsp; </>}MODE INFO
              </div>
            </div>
          </div>
          <div className="preview-controls">
            <button onClick={() => previewMove("left")} aria-label="Previous page">←</button>
            <span className="dpad">
              <button onClick={() => previewMove("up")} aria-label="Move up">↑</button>
              <button onClick={() => previewMove("down")} aria-label="Move down">↓</button>
            </span>
            <button onClick={() => previewMove("right")} aria-label="Next page">→</button>
          </div>
        </div>
      </section>

      <section className="builder-section" aria-labelledby="builder-heading">
        <div className="section-heading">
          <div><p className="step-kicker">01 · CATALOG</p><h2 id="builder-heading">Add your programs</h2></div>
          <p>Start empty, then drop genuine TI-BASIC <code>.8xp</code> files or add exact calculator names manually. Checked files can be sent directly later.</p>
        </div>

        <div
          className={`drop-zone ${dragging ? "dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInput.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") fileInput.current?.click();
          }}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".8xp"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="drop-icon">8xp</div>
          <div><strong>Drop TI-BASIC programs here</strong><span>or tap to browse your files</span></div>
          <small>Assembly and C programs are rejected</small>
        </div>

        <div className="catalog-toolbar">
          <button className="secondary-button" onClick={addManual}>+ Add manual entry</button>
          {loadedTransferCount > 0 && <button className="quiet-button" onClick={() => selectAllLoaded(true)}>Check loaded</button>}
          {loadedTransferCount > 0 && <button className="quiet-button" onClick={() => selectAllLoaded(false)}>Uncheck all</button>}
          {entries.length > 0 && <button className="quiet-button" onClick={clearCatalog}>Clear catalog</button>}
          <span>{selectedGameEntries.length} checked · {loadedTransferCount} file{loadedTransferCount === 1 ? "" : "s"} loaded · {entries.length} catalog</span>
        </div>

        <div className="catalog" aria-live="polite">
          {entries.map((entry, index) => (
            <article className="program-row" key={entry.id}>
              <div className="row-flags">
                <button
                  className={`favorite-button ${entry.favorite ? "active" : ""}`}
                  onClick={() => updateEntry(entry.id, { favorite: !entry.favorite })}
                  aria-label={`${entry.favorite ? "Remove" : "Add"} ${entry.title} ${entry.favorite ? "from" : "to"} favorites`}
                  title="Compile into Favorites"
                >★</button>
                <label
                  className={`transfer-check ${gameFiles[entry.id] ? "available" : ""}`}
                  title={gameFiles[entry.id] ? "Include this file in Send checked games" : "Add this .8xp file to make it transferable"}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selectedTransfers[entry.id])}
                    disabled={!gameFiles[entry.id]}
                    onChange={(event) => setSelectedTransfers((current) => ({ ...current, [entry.id]: event.target.checked }))}
                    aria-label={`Send ${entry.title} with checked games`}
                  />
                  <i aria-hidden="true" />
                </label>
              </div>
              <label><span>Calculator name</span><input value={entry.programName} maxLength={8} readOnly={Boolean(gameFiles[entry.id])} title={gameFiles[entry.id] ? "Locked to the name stored in the loaded .8xp file" : undefined} onChange={(event) => updateEntry(entry.id, { programName: normalizeProgramName(event.target.value) })} /></label>
              <label><span>Display title</span><input value={entry.title} maxLength={21} onChange={(event) => updateEntry(entry.id, { title: sanitizeDisplay(event.target.value, entry.programName) })} /></label>
              <label><span>Category</span><input value={entry.category} maxLength={18} onChange={(event) => updateEntry(entry.id, { category: sanitizeDisplay(event.target.value, "PROGRAMS") })} /></label>
              <div className="row-actions">
                <button onClick={() => moveEntry(index, -1)} disabled={index === 0} aria-label={`Move ${entry.title} up`}>↑</button>
                <button onClick={() => moveEntry(index, 1)} disabled={index === entries.length - 1} aria-label={`Move ${entry.title} down`}>↓</button>
                <button className="remove" onClick={() => removeEntry(entry.id)} aria-label={`Remove ${entry.title}`}>×</button>
              </div>
            </article>
          ))}
          {!entries.length && (
            <div className="empty-state">
              <strong>No preset catalog.</strong>
              <span>Add your first TI-BASIC program above.</span>
            </div>
          )}
        </div>
      </section>

      <section className="features-section" id="features">
        <div className="section-heading">
          <div><p className="step-kicker">02 · FEATURES</p><h2>Configure the shell</h2></div>
          <p>Everything here is compiled into the launcher. Turn off anything you do not need to save space.</p>
        </div>
        <div className="feature-grid">
          <label className="theme-card">
            <span>Color theme</span>
            <select value={options.theme} onChange={(event) => setOption("theme", event.target.value as ThemeKey)}>
              {Object.entries(THEMES).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}
            </select>
            <span className="palette" style={previewStyle}><i /><i /><i /><i /></span>
          </label>
          <ToggleCard title="Favorites page" detail="Star programs in the catalog to duplicate them onto a front-page Favorites section." checked={options.enableFavorites} onChange={(value) => setOption("enableFavorites", value)} />
          <ToggleCard title="Search" detail="ALPHA opens title/program-name search. Results are limited to the first six matches." checked={options.enableSearch} onChange={(value) => setOption("enableSearch", value)} />
          <ToggleCard title="Recent program" detail="MODE shows the last program that returned normally during the current Osmium session." checked={options.enableRecent} onChange={(value) => setOption("enableRecent", value)} />
          <ToggleCard title="Startup splash" detail="Show a short branded color splash before opening the catalog." checked={options.showSplash} onChange={(value) => setOption("showSplash", value)} />
          <label className="pin-card">
            <span>Optional startup PIN</span>
            <input inputMode="numeric" placeholder="Disabled" value={options.pin} maxLength={6} onChange={(event) => setOption("pin", normalizePin(event.target.value))} />
            <small>1–6 digits. This is a deterrent, not secure encryption.</small>
          </label>
        </div>
      </section>

      <section className="compile-section">
        <div className="compile-card">
          <div><p className="step-kicker">03 · BUILD</p><h2>Compile Osmium</h2><p>The output is a genuine tokenized TI-BASIC program with hard-coded calls and state repair after every returning game.</p></div>
          <label className="launcher-field"><span>Launcher name</span><input value={launcherName} maxLength={8} onChange={(event) => setLauncherName(normalizeProgramName(event.target.value))} /></label>
          <div className="build-summary"><strong>{pages.length}</strong><span>launcher pages</span><strong>{build?.source.length ?? 0}</strong><span>source characters</span><strong>{build?.features.length ?? 0}</strong><span>enabled features</span></div>
          {build?.warnings.map((warning) => <div className="warning-box" key={warning}>{warning}</div>)}
          {errors.length > 0 && <div className="error-box">{errors.map((error) => <span key={error}>{error}</span>)}</div>}
          <button className="compile-button" disabled={!module || !build || errors.length > 0} onClick={() => void compile()}>
            <span>Compile {normalizeProgramName(launcherName) || "OSMIUM"}.8xp</span><b>↓</b>
          </button>
          <div className="project-actions">
            <button onClick={saveProject}>Save project</button>
            <label>Load project<input type="file" accept=".json" hidden onChange={(event) => void loadProject(event)} /></label>
            {build && <button onClick={() => downloadFile("OSMIUM-source.txt", build.source, "text/plain")}>Download BASIC source</button>}
          </div>
          <p className="notice" role="status">{notice}</p>
        </div>
      </section>

      <section className="transfer-section" id="transfer">
        <div className="transfer-card">
          <div className="transfer-copy">
            <p className="step-kicker">04 · SEND</p>
            <h2>Send over USB</h2>
            <p>
              Use one button for only the checked game files and the other for only the newly
              compiled launcher. Your full catalog stays inside Osmium, so adding a game never
              requires reinstalling everything already on the calculator.
            </p>
          </div>
          <div className={`usb-state ${usbSupported === false ? "unsupported" : ""}`}>
            <span className="usb-dot" />
            <div><strong>Calculator connection</strong><small>{usbStatus}</small></div>
          </div>
          <div className="transfer-actions">
            <button
              className="send-games"
              disabled={!usbSupported || transferBusy || selectedGameEntries.length === 0}
              onClick={() => void sendSelectedGames()}
            >
              <span>Send checked games</span>
              <b>{selectedGameEntries.length}</b>
            </button>
            <button
              className="send-osmium"
              disabled={!usbSupported || transferBusy || !module || !build || errors.length > 0}
              onClick={() => void sendOsmium()}
            >
              <span>Send {normalizeProgramName(launcherName) || "OSMIUM"} only</span>
              <b>USB</b>
            </button>
          </div>
          <div className="transfer-progress" aria-hidden="true">
            <i style={{ width: transferTotal ? `${Math.max(transferBusy ? 4 : 0, transferProgress / transferTotal * 100)}%` : "0%" }} />
          </div>
          <p className="usb-note">
            Transfers remain local and require a WebUSB browser such as Chrome, Edge, or Chromium,
            a data-capable USB cable, and the calculator on its home screen. The device chooser
            opens from either send button.
          </p>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-heading"><div><p className="step-kicker">05 · RUN</p><h2>From browser to calculator</h2></div></div>
        <div className="how-grid">
          <article><span>1</span><h3>Build the launcher</h3><p>Osmium generates a color graph-screen interface and fixed dispatch table for your selected programs.</p></article>
          <article><span>2</span><h3>Send only what changed</h3><p>Check new game files and send them together, then send only the rebuilt Osmium launcher. Downloads still work with TI Connect CE.</p></article>
          <article><span>3</span><h3>Run from PRGM</h3><p>Use arrows to navigate, ENTER or 2nd to launch, ALPHA to search, MODE for information, and CLEAR to exit.</p></article>
        </div>
        <aside className="limits"><strong>Return behavior:</strong> Osmium now reconstructs its page, selection, colors, and recent entry after a game returns normally. A game that uses <code>Stop</code> terminates the entire call stack and therefore returns to the calculator home screen by TI-BASIC design.</aside>
      </section>

      <footer><div className="brand"><span className="atom-mark small" aria-hidden="true"><i /><i /><i /><b /></span><span>OSMIUM</span></div><p>Independent GPL version 3 software with no warranty. USB transfer powered by <a href="https://github.com/Timendus/ticalc-usb" target="_blank" rel="noreferrer">ticalc-usb</a>. Not affiliated with Cesium or Texas Instruments. Source and credits are available in this repository.</p><span>v0.3.2</span></footer>
    </main>
  );
}

function ToggleCard({
  title,
  detail,
  checked,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`toggle-card ${checked ? "enabled" : ""}`}>
      <span className="toggle-heading"><strong>{title}</strong><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></span>
      <small>{detail}</small>
    </label>
  );
}
