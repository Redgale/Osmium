# Changelog

All notable changes to Osmium are documented here.

## [0.3.2] - 2026-08-08

- Made build-script chaining independent of executable file-mode preservation,
  fixing Cloudflare builds from source archives committed through Windows.
- Fixed invalid `Text(` coordinates by keeping generated graph-screen values in
  the TI-84 Plus CE's legal ranges.
- Added a full generated-source audit for coordinates, command delimiters,
  labels, and control-flow safety.
- Added full validation mode to the builder UI.
- Strengthened launcher redraw and return-path handling.

## [0.3.1] - 2026-08-08

- Fixed tokenization of commands whose closing delimiter is part of the TI token.
- Added regression coverage for the generated startup command sequence.

## [0.3.0] - 2026-08-08

- Added direct WebUSB calculator transfer through `ticalc-usb`.
- Added per-game transfer checkboxes and separate game/launcher send actions.
- Added re-upload matching for saved catalog entries.
- Moved the project to GPL version 3 for the integrated GPL dependency.

## [0.2.0] - 2026-08-07

- Removed example presets from the default catalog.
- Added color themes, favorites, search, recents, splash, and PIN options.
- Reworked control flow so the interface is reconstructed after normal game returns.
- Added project import/export and source export.

## [0.1.0] - 2026-08-07

- Initial browser-based TI-BASIC launcher generator and calculator demo.
