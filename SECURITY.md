# Security policy

Please report vulnerabilities privately through the GitHub security advisory form of this repository
(<https://github.com/csabatibortoth/skrifari/security/advisories/new>), not in a public issue. Include the version, what you did,
and what happened. You will get an answer within a few days. Skrifari is pre-release (0.x): only the latest version is supported.

Never commit secrets. The API refuses to start in production with a missing or placeholder secret (see `.env.example`).
