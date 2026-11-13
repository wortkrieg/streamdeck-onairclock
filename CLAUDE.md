# On Air Clock: notes for coding agents

Elgato Stream Deck plugin (SDK v3, Node.js 24, TypeScript) with broadcast-style studio clocks and a countdown. It is open source and has one maintainer. The Elgato Marketplace has installed it tens of thousands of times, so existing keys and settings must keep working across updates.

## Layout

- `src/core/`: pure logic, such as settings defaults and normalization, time zones, countdown state and face models. Nothing here imports the Stream Deck SDK.
- `src/render/`: pure SVG rendering with its own digit shapes and no fonts. The faces live in `src/render/faces/`.
- `src/plugin/`: SDK glue, meaning the actions, the controllers and one shared ticker for all keys. `src/plugin.ts` registers everything.
- `fail.marc.onairclock.sdPlugin/`: the manifest, the property inspectors (`ui/*.html` with the vendored sdpi-components) and the images. `bin/` and `logs/` are build output.
- `assets/brand/`: SVG sources for the icons and marketing art. `scripts/build-assets.ts` renders them.
- `docs/superpowers/specs/2026-11-11-v2-design.md`: why V2 looks and works the way it does.

## Commands

```sh
npm ci
npm test              # Vitest
npm run typecheck
npm run lint          # Biome, tabs
npm run build         # rollup -> fail.marc.onairclock.sdPlugin/bin
npm run validate      # streamdeck validate
npm run build:dev     # dev variant into build/
npx streamdeck link build/fail.marc.onairclock.dev.sdPlugin
npx streamdeck restart fail.marc.onairclock.dev
npm run assets        # regenerate icons, key images, gallery, GIFs
```

Run test, typecheck, lint, build and validate before every commit.

## How we work

- **Compatibility:** Never change the plugin UUID `fail.marc.onairclock` or an action UUID. Keep the V1 setting names readable: `dotcolor`, `inactivecolor`, `backgroundcolor`, `ampmindicator`, `hourFormat`, `dateType`. A missing or invalid stored value falls back to the defaults in `src/core/settings.ts`.
- **Settings UI:** The setting keys and defaults in `ui/*.html` must match `src/core/settings.ts`, and the `*-pi.test.ts` tests check this. Never put `default="false"` on an `sdpi-checkbox`, because sdpi reads the string as true.
- **Tests first:** Logic goes into `core/` or `render/` so it can be tested without the SDK. Face snapshots change only on purpose (`npx vitest run -u`), and the commit says why.
- **Generated images:** Change the SVG source or the renderer, then run `npm run assets`. Never edit the PNGs by hand.
- **Hardware tests:** Use the dev variant. It has its own UUIDs (`fail.marc.onairclock.dev.*`) and runs next to an installed release without touching its profiles.
- **Privacy:** Never commit Stream Deck profiles (`*.streamDeckProfile`, `*.sdProfile`), because they contain device serial numbers. Keep personal data such as emails and serial numbers out of code, docs and commit messages.
- **Language:** Write code, comments, docs and UI texts in English.
- **Commits:** Use Conventional Commits with a scope, such as `feat(clock): …`, `fix(render): …` or `chore(release): …`. Every change users will notice gets a line in `CHANGELOG.md` under the next version.

## Releases

- Set the version in `package.json` and in the manifest (`X.Y.Z.0`), and add a section `## X.Y.Z (date)` to `CHANGELOG.md`.
- Pushing the tag `vX.Y.Z` runs `.github/workflows/release.yml`. It tests, builds and packs the plugin, then creates a draft GitHub release with that CHANGELOG section as its notes.
- Pushing to `main`, tags, publishing releases, Marketplace submissions and issue comments are the maintainer's call. Contributors open a pull request against `main`.
