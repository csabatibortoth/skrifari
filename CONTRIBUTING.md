# Contributing to Skrifari

Skrifari is licensed under the Apache License, Version 2.0.

By submitting a contribution intended for inclusion, you agree that it is submitted under Apache-2.0 unless a separate written agreement says otherwise. You retain copyright ownership of your contribution and confirm that you have the right to submit it.

## Developer Certificate of Origin (DCO)

Contributors must use the Developer Certificate of Origin (DCO), version 1.1. Each commit must include a sign-off, for example:

    Signed-off-by: Your Name <your-email@example.com>

Create signed-off commits with:

    git commit -s

DCO text: https://developercertificate.org/

## Third-party material

Do not submit third-party code, assets, fonts, images, or documentation unless their licenses permit the intended use and distribution. Identify third-party material and preserve required notices (see `THIRD_PARTY_NOTICES.md`).

## Source headers and notices

New original source files should include the project's Apache-2.0 header (see `docs/SOURCE_HEADER.md`). Do not remove existing copyright or attribution notices.

## Trademarks

Contributing does not grant ownership of or permission to use Skrifari trademarks. See `TRADEMARKS.md`.

## Pull requests

By opening a pull request, you confirm that you have the right to submit the contribution, have identified relevant third-party material, have included the required DCO sign-off, and do not knowingly violate another party's intellectual property rights.

## Code standards

JavaScript only: ES modules, `.js` files, JSDoc for public interfaces. No TypeScript and no TypeScript build step. Validate all untrusted input at runtime.
