# Third-Party Notices

Skrifari includes or may distribute third-party software and materials. Each component remains subject to its own copyright and license terms. Preserve applicable license texts, copyright notices, and attribution requirements.

| Component                | Version                                                                                          | License / SPDX ID | Source                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------- |
| Athena UI (athena-ui-js) | 2.7.1 (pin with ^2.7.1, update deliberately; copyright (c) 2018 Csaba Tóth; verified 2026-11-24) | MIT               | https://github.com/csabatibortoth/athena-ui |
| fastify                  | ^5                                                                                               | MIT               | https://github.com/fastify/fastify          |
| mongoose                 | ^8                                                                                               | MIT               | https://github.com/Automattic/mongoose      |
| ioredis                  | ^5                                                                                               | MIT               | https://github.com/redis/ioredis            |
| vitest (dev only)        | ^5                                                                                               | MIT               | https://github.com/vitest-dev/vitest        |
| eslint (dev only)        | ^9                                                                                               | MIT               | https://github.com/eslint/eslint            |
| prettier (dev only)      | ^3                                                                                               | MIT               | https://github.com/prettier/prettier        |
| [Other component]        | [Version]                                                                                        | [SPDX ID]         | [Project URL]                               |

For Athena UI, include the exact MIT license and copyright notice from the version distributed with Skrifari, following the dependency's distribution requirements.

This file is informational and does not change the license terms of any third-party component. Regenerate the dependency rows from `package-lock.json` before each release and audit fonts, icons, images, templates, and other bundled assets by hand.

## Licence audit (2026-11-24, M1)

`package-lock.json` was checked licence by licence. Everything that ships (runtime dependencies and Athena UI) is MIT, ISC, BSD-2/3-Clause, Apache-2.0, 0BSD or BlueOak-1.0.0 (glob, lru-cache, minipass, path-scurry: permissive, compatible with Apache-2.0).
MPL-2.0 (lightningcss, a dependency of the test runner) and Python-2.0 (argparse) appear only as development dependencies: they are not part of the container image or of a release. Re-run the check when the lock changes:
`node -e "const l=require('./package-lock.json');for(const [k,v] of Object.entries(l.packages))if(k&&v.license&&!/^(MIT|ISC|BSD-[23]-Clause|Apache-2.0|0BSD|BlueOak-1.0.0)$/.test(v.license))console.log(k,v.license,v.dev?'dev':'RUNTIME')"`.
The admin app contains no fonts, icons or images of its own; Athena UI's assets are MIT (its own).
