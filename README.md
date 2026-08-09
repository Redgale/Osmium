# Osmium Shell Builder

[![Version](https://img.shields.io/badge/version-0.3.2-6d4aff)](CHANGELOG.md)
[![TI-BASIC](https://img.shields.io/badge/target-TI--84%20Plus%20CE-f1a33c)](#what-osmium-is)
[![CI](https://github.com/RedGale7/osmium/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)

Osmium is an independent, browser-based launcher builder for pure TI-BASIC
programs on the TI-84 Plus CE. Select your `.8xp` programs, arrange the menu,
and download or send a tokenized `OSMIUM.8xp` directly from the browser.

Try the hosted builder: <https://osmium.red-gale7.workers.dev>

## What Osmium is

Osmium generates an ordinary TI-BASIC `prgmOSMIUM` with a fixed dispatch table.
It is designed as a practical launcher for users on OS versions such as 5.8.5
while native-code exploit support is unavailable.

Osmium is **not** an exploit, App, assembly shell, OS patch, VAT browser, or
replacement for arTIfiCE. It launches compatible TI-BASIC programs only; it
cannot make assembly or C games run on an otherwise unsupported OS.

## Features

- Local, browser-only `.8xp` inspection and launcher generation
- Drag-and-drop catalog with editable titles, categories, and ordering
- Rejection of known assembly/C program headers
- Four calculator color themes with an interactive preview
- Compile-time favorites, title search, recent-program shortcut, splash, and PIN
- Rebuilt launcher state after a game returns normally
- Generated-source audit for coordinates, delimiters, labels, and control flow
- Per-file transfer checkboxes and WebUSB batch transfer for selected games
- A separate button for sending only the regenerated Osmium launcher
- Matching re-uploads that attach bytes to saved catalog entries without duplicates
- Project JSON import/export and readable TI-BASIC source export

## Use it

1. Open the hosted builder or run it locally.
2. Drop TI-BASIC `.8xp` program files into the catalog.
3. Rename, categorize, order, favorite, and select entries as needed.
4. Download `OSMIUM.8xp`, or connect a calculator and use **Send OSMIUM only**.
5. Optionally check uploaded games and use **Send checked games** to transfer them.
6. On the calculator, run `prgmOSMIUM` from the `PRGM` menu.

Uploaded calculator files remain in browser memory. Saved project JSON contains
the catalog and settings, but deliberately does not embed program binaries. When
reopening a project, upload only new or replacement files; matching calculator
program names reconnect to existing entries.

## Calculator controls

| Key | Action |
| --- | --- |
| Arrow keys | Move through entries and pages |
| `ENTER` / `2nd` | Launch the selected program |
| `ALPHA` | Search by entering a quoted uppercase string such as `"MARIO"` |
| `MODE` | Open information, recent-program access, and About |
| `CLEAR` | Return to the launcher or exit |

Osmium redraws itself after a called program returns normally. A program that
executes `Stop` ends the entire TI-BASIC call stack. Change such a game to use
`Return` or to reach its natural end if it should return to Osmium.

## Direct USB transfer

WebUSB transfer requires Chrome, Edge, or another Chromium browser, a
data-capable USB cable, and a supported calculator on its home screen. Firefox
and Safari do not currently expose WebUSB. Download the generated files and use
TI Connect CE when WebUSB is unavailable.

USB support is intentionally treated as experimental. Keep backups of important
calculator files and report the calculator model, OS version, and browser when
filing a transfer bug.

## Local development

Requirements: Node.js 22.13 or newer and npm.

```sh
git clone <your-repository-url>
cd osmium
npm ci
npm run dev
```

Before submitting a change, run:

```sh
npm run lint
npm test
npm run build:demo
```

`npm test` runs the generator tests, a production build, artifact validation,
and rendered-HTML checks. `npm run build:demo` regenerates the checked-in
calculator examples.

## Project layout

| Path | Purpose |
| --- | --- |
| `app/` | Browser UI and styling |
| `lib/osmium.ts` | TI-BASIC generation, `.8xp` parsing, tokenization, and auditing |
| `tests/` | Generator and production-output regression tests |
| `calculator-demo/` | Generated demo `.8xp` files and readable source |
| `public/vendor/` | Vendored TIVarsLib tokenizer and its MIT license |
| `scripts/` | Reproducible builds, artifact validation, and demo generation |
| `worker/` | Cloudflare/Vinext application entry point |
| `docs/` | Architecture and hardware-testing notes |

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data flow.

## Known limitations

- The catalog is compiled into `OSMIUM`; it is not discovered dynamically from
  the calculator's variable table.
- Only TI-BASIC programs are supported. Assembly, C, Python, Apps, AppVars, and
  programs that depend on native loaders are outside the project's scope.
- Favorites, categories, and display names change only when the launcher is rebuilt.
- Search uses TI-BASIC string input, including quotation marks.
- Project JSON does not contain the original `.8xp` binaries.
- `Stop` in a launched program exits the entire launcher stack.

## Independence and credits

Osmium is a separate project inspired by the general concept of calculator
program shells, including Cesium. It is not affiliated with the Cesium team or
Texas Instruments and contains no Cesium source or branding.

The actual implementation uses TIVarsLib for tokenization and `ticalc-usb` for
WebUSB communication, with `ticalc.link` serving as a transfer-flow reference.
Every calculator-specific resource and direct web/build dependency is identified
in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

Osmium v0.3 and later are licensed under GPL version 3. The repository's
existing `LICENSE` file contains the complete terms. This source archive does
not replace that file.

