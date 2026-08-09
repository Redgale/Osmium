# Security policy

## Supported releases

Security fixes are applied to the current 0.3.x release line. Older generated
launchers may be replaced by rebuilding with the latest published source.

## Reporting a vulnerability

Please use the repository's **Security** tab and open a private security
advisory. Include a concise reproduction, affected browser/version, calculator
model and OS when relevant, and the impact you observed. Do not publish an
exploit or sensitive device data in a public issue before maintainers have had a
reasonable opportunity to investigate.

If private advisories are not enabled, open a public issue containing only a
request for a private contact channel—do not include the vulnerability details.

## Data and trust boundaries

Selected `.8xp` files and project JSON are processed locally in the browser.
Osmium does not intentionally upload calculator files to an application server.
WebUSB access requires a browser permission prompt and is used only after an
explicit send action. Treat generated programs and third-party game files as
untrusted until reviewed, and keep backups of important calculator data.

