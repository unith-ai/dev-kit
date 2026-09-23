# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in this repository,
please report it privately by email to
**[support@unith.ai](mailto:support@unith.ai)** with the subject line
`Security report: UNITH Developer Kit`.

**Do not report security issues through public GitHub issues, pull requests,
or any other public channel.**

Please include:

- A description of the issue and its potential impact.
- The affected file(s) and the release version or commit.
- Steps to reproduce, or a proof of concept.

Do not include real credentials, secret keys, bearer tokens, or personal data
in your report. If sensitive evidence is needed, say so in your first email and
UNITH will arrange a secure way to share it.

UNITH will review your report and follow up with you by email. Please give us
reasonable time to investigate and address the issue before disclosing it
publicly.

The same address can be used to report security issues in the UNITH platform
itself.

## Supported versions

Security fixes are provided for the latest release only.

## If you exposed your own credentials

If you accidentally shared or committed your UNITH secret key, regenerate it
immediately in interFace → **Manage Account**. Bearer tokens remain valid for
up to 7 days after they are issued.

## Known limitations of the demo code

This kit is teaching material, not production code. The following behaviors
are intentional and documented, and are not considered vulnerabilities:

- The demo server's `/plugin` and `/tools/*` endpoints accept unauthenticated
  requests and send permissive CORS headers.
- Webhook signature verification is skipped when `UNITH_WEBHOOK_SECRET` is not
  set, with a warning in the console.
- The organization `api_key` used in embed snippets is public by design;
  production heads are protected by their `allowedOrigins` allow-list.

A production integration must authenticate its endpoints and restrict allowed
origins. See the [security notes](README.md#security-notes) in the README.
