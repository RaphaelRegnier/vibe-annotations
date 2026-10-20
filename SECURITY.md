# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Vibe Annotations seriously. If you have discovered a security vulnerability in our project, we appreciate your help in disclosing it to us in a responsible manner.

### Reporting Process

Please report security vulnerabilities by emailing the project maintainers directly. We will acknowledge your email within 48 hours, and send a more detailed response within 96 hours indicating the next steps in handling your report.

### What to Include

Please include the following information in your report:

* Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
* Full paths of source file(s) related to the manifestation of the issue
* The location of the affected source code (tag/branch/commit or direct URL)
* Any special configuration required to reproduce the issue
* Step-by-step instructions to reproduce the issue
* Proof-of-concept or exploit code (if possible)
* Impact of the issue, including how an attacker might exploit the issue

### What to Expect

After you submit a vulnerability report, you can expect:

1. **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
2. **Communication**: We will keep you informed about the progress of addressing the vulnerability
3. **Resolution**: We will work on a fix and coordinate with you on the disclosure timeline
4. **Recognition**: With your permission, we will acknowledge your contribution in the security advisory

### Security Update Process

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all still-supported versions
4. Release new versions as soon as possible

## Security Best Practices

When using Vibe Annotations:

1. **Keep Updated**: Always use the latest version of both the Chrome extension and the server
2. **Local Only**: The system is designed for localhost development only - never expose the server to the internet
3. **Data Privacy**: Annotations are stored locally and never sent to external servers
4. **Extension Permissions**: The extension only requests necessary permissions for localhost domains

Thank you for helping keep Vibe Annotations and our users safe!
## Local transport security and upgrade

Update the extension and server together. The HTTP listener binds to `127.0.0.1:3846`, validates Host and the exact authorized extension Origin, and requires a bearer credential for every data endpoint (HTTP API, attachments, exports, MCP, and legacy SSE). DNS rebinding protection is enabled. Only the non-sensitive health probe and authorized CORS preflights are unauthenticated.

Run `vibe-annotations-server init` again to replace old HTTP-only agent configurations with the local stdio proxy. It reads `~/.vibe-annotations/auth-token` directly, so project configs contain no credential. The token is randomly generated and written with mode 0600 on systems supporting POSIX permissions; Windows uses the current user's directory ACLs. Authentication protects against other origins and network clients, not malicious code already running as the same OS user.

Run `vibe-annotations-server token` and paste it only into the extension's Options page. The extension keeps it in trusted session storage and needs pairing again after Chrome restarts. Requests from content scripts are proxied through the background; credentials are never put in page storage, DOM, query strings or attachment links. To revoke clients, stop the server, remove the auth-token file, restart, and pair again.

For a development/unpacked extension, set `VIBE_ANNOTATIONS_EXTENSION_ID` to the exact extension ID from chrome://extensions. WSL/cross-host access needs an explicitly secured tunnel. Do not expose the local port on a network.

The unauthenticated `window.__vibeAnnotations` annotation API is removed. A read-only MAIN-world bridge still inspects React/Vue source hints; its results are page-supplied context, never authenticated instructions. Reload existing annotation tabs after upgrading and review pending/imported feedback before enabling watch mode. Manual annotation, copy/paste and authenticated agent processing remain available.

Screenshots use `activeTab`, activated by the extension icon or registered shortcut. The extension no longer requests blanket screenshot access and revokes previous blanket optional grants when restoring sites. Public-site annotation is granted per site. A screenshot is discarded if the active tab changes during capture. SVG attachments are not displayed in the extension image viewer; raster images remain supported.

Security regression tests: run `node --test` from the repository root. Production extension build: `pnpm --filter vibe-annotations-extension build`. Use a checkout path without `#` because Vite interprets it as a URL fragment.
