# Security policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `master` (live on Netlify) | Yes |

## Reporting a vulnerability

If you discover a security issue, **do not open a public GitHub issue** with exploit details.

Contact the maintainer privately (e.g. via GitHub profile contact or repository owner message) with:

- Description and impact
- Steps to reproduce
- Suggested fix (if any)

## Practices in this project

| Area | Approach |
|------|----------|
| Passwords | bcrypt hashes only; never stored in plain text |
| Sessions | JWT (Bearer), `JWT_SECRET` from environment |
| Input | `sanitize-html` on user-generated text; strict username/email validation |
| Authorization | `requireAuth` / `requireSelf`; DM only between accepted friends |
| Secrets | No production secrets in git; use Netlify env vars |
| Dependencies | `npm audit` in CI; overrides for known transitive dev-deps |

Full architecture and endpoint auth rules: [README.md](README.md).
