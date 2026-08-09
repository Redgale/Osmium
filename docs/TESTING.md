# Testing guide

## Automated checks

Run `npm run lint`, `npm test`, and `npm run build:demo`. The test command covers
generator behavior, a production build, artifact structure, and rendered HTML.

## Calculator smoke test

Use a backup calculator or back up important files first.

1. Build a launcher containing two small TI-BASIC test programs.
2. Transfer both programs and `OSMIUM.8xp`.
3. Confirm arrow navigation, page changes, `ENTER`, and `2nd` launches.
4. Exit the first game by reaching its natural end and confirm the menu redraws.
5. Exit the second with `Return` and confirm the menu redraws again.
6. Verify `ALPHA` search with a quoted uppercase string.
7. Verify the recent-program shortcut and favorites page.
8. Test `CLEAR` from submenus and from the main menu.
9. Repeat with optional splash and PIN enabled.

For a negative test, use a disposable program containing `Stop` and confirm it
returns to the home screen. That behavior is a TI-BASIC language constraint, not
a launcher crash.

## WebUSB smoke test

1. Use a current Chromium browser and a data-capable cable.
2. Load two `.8xp` files, uncheck one, and select **Send checked games**.
3. Confirm only the checked game arrives.
4. Select **Send OSMIUM only** and confirm the launcher arrives separately.
5. Export and reload the project JSON, then re-upload one matching `.8xp` file.
6. Confirm it attaches to the existing catalog entry instead of duplicating it.

Record model, OS, browser, cable behavior, and exact calculator error text for
any failure.

