# Third-party notices and acknowledgements

This file records the projects, documentation, and direct dependencies used to
develop and distribute Osmium 0.3.2. Package versions are locked in
`package-lock.json`; that file is the authoritative dependency inventory.

## Calculator projects and resources

### Cesium

- Project: <https://github.com/mateoconlechuga/cesium>
- Copyright: 2015–2024 Matt "MateoConLechuga" Waltz
- License: BSD 3-Clause
- Use in Osmium: conceptual inspiration for a calculator program shell and its
  navigation model only.

No Cesium source, binaries, assets, or branding are included in Osmium. Osmium
is not affiliated with or endorsed by the Cesium contributors.

### ticalc-usb 1.1.2

- Project: <https://github.com/Timendus/ticalc-usb>
- Author: Timendus and contributors
- License: GPL-3.0-or-later
- Use in Osmium: direct browser-to-calculator WebUSB communication, device
  selection, storage checks, and TI variable transfer.

`ticalc-usb` is an installed dependency and is bundled into production output.
Its GPL license is why Osmium v0.3 and later are distributed under GPL version 3.

### ticalc.link

- Project: <https://github.com/Timendus/ticalc.link>
- Author: Timendus and contributors
- License: GPL-3.0-or-later
- Use in Osmium: reference implementation for the browser transfer interaction
  and the sequence used to send calculator files with `ticalc-usb`.

Osmium does not use the ticalc.link favicon or other visual assets.

### tivars_lib_cpp / TIVarsLib

- Project: <https://github.com/adriweb/tivars_lib_cpp>
- Copyright: 2015–2026 Adrien "Adriweb" Bertrand
- License: MIT
- Use in Osmium: vendored WebAssembly/JavaScript tokenizer that converts the
  generated TI-BASIC source into a valid `.8xp` program file in the browser.

The complete license supplied with the vendored build is retained at
`public/vendor/TIVarsLib-LICENSE.txt`.

### Texas Instruments documentation

- [TI-84 Plus CE guidebooks](https://education.ti.com/en/guidebook/details/en/3BBF042421644CE2AF713484B03A8B11/ti-84-plus-ce)
- [TI-Basic Programming Guide for the TI CE family](https://education.ti.com/-/media/377A0772C3B04D83B83D2A4E51029D08)
- [TI-84 Plus CE Reference Guide](https://education.ti.com/-/media/A266A605960A4B4BBC66F8F2283D08D4)

These documents were technical references for TI-BASIC syntax, program
behavior, keys, color constants, and graph-screen coordinate limits. No TI
documentation is redistributed in this repository.

Texas Instruments, TI, TI-84 Plus CE, and TI Connect CE are names or marks of
Texas Instruments Incorporated. Their use here is descriptive. Osmium is not
affiliated with or endorsed by Texas Instruments.

## Direct application and build dependencies

The following direct dependencies are installed from npm. Their own source
repositories contain the full license notices and contributor lists.

| Project | Version | License | Purpose |
| --- | ---: | --- | --- |
| [React / React DOM](https://github.com/facebook/react) | 19.2.6 | MIT | Browser UI |
| [Next.js](https://github.com/vercel/next.js) | 16.2.6 | MIT | Application framework |
| [ticalc-usb](https://github.com/Timendus/ticalc-usb) | 1.1.2 | GPL-3.0-or-later | Calculator transfer |
| [Vinext](https://github.com/cloudflare/vinext) | 0.0.50 | MIT | Vite-based Next.js runtime |
| [Vite](https://github.com/vitejs/vite) | 8.0.13 | MIT | Development and production builds |
| [Cloudflare Vite plugin / Wrangler](https://github.com/cloudflare/workers-sdk) | 1.37.1 / 4.92.0 | MIT; MIT OR Apache-2.0 | Worker development and deployment |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | 4.2.1 | MIT | CSS processing |
| [TypeScript](https://github.com/microsoft/TypeScript) | 5.9.3 | Apache-2.0 | Type checking and compilation |
| [ESLint](https://github.com/eslint/eslint) | 9.39.4 | MIT | Static analysis |
| [tsx](https://github.com/privatenumber/tsx) | 4.23.11 | MIT | TypeScript script/test execution |
| [Vite React plugins](https://github.com/vitejs/vite-plugin-react) | 6.0.2 / 0.5.26 | MIT | React and RSC transforms |

### Geist typeface

- Project: <https://github.com/vercel/geist-font>
- Copyright: 2023 Vercel, in collaboration with basement.studio
- License: SIL Open Font License 1.1
- Use in Osmium: the browser interface requests Geist Sans and Geist Mono
  through Next.js font handling.

Transitive packages and their exact resolved versions are listed in
`package-lock.json`. No third-party project listed above endorses Osmium.
