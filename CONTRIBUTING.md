# Contributing to Osmium

Thanks for helping improve Osmium. Bug reports from real calculators are
especially valuable because browser, cable, calculator revision, and OS version
can all affect the result.

## Scope

Osmium intentionally remains a pure TI-BASIC launcher generator. Changes should
not add exploit delivery, OS patching, native-code execution, or copied Cesium
code/assets. Assembly and C program support is outside the current scope.

## Set up a development copy

```sh
npm ci
npm run dev
```

Node.js 22.13 or newer is required. Do not commit `node_modules`, `.env` files,
build output, local Wrangler state, or generated release archives.

## Before opening a pull request

```sh
npm run lint
npm test
npm run build:demo
```

Commit regenerated files in `calculator-demo/` when generator output changes.
Add or update a regression test for every generator bug. For coordinate errors,
delimiter errors, missing labels, or unsafe transfers, include the exact output
or calculator error screen information in the pull request.

## Calculator testing

When possible, test both the downloaded `.8xp` workflow and direct USB transfer.
Record:

- calculator model and hardware revision, if known;
- exact OS version;
- browser name and version;
- whether the file was downloaded or sent with WebUSB;
- the calculator error type and line selected by `Goto`, if an error occurred;
- whether the launched program returns normally, uses `Return`, or uses `Stop`.

Never attach private calculator backups or unrelated personal files to an issue.

## Pull requests

Keep changes focused. Explain the user-visible behavior, testing performed, and
any new third-party code or documentation. New dependencies require an entry in
`THIRD_PARTY_NOTICES.md`, a compatible license, and an updated lockfile.

