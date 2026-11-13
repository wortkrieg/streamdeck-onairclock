#!/bin/sh
# Collects every marketing asset into marketing/upload/ (untracked) for manual uploads.
# Run after `npm run assets` (and `npm run assets:video`); PNGs come with an @2x rendering.
set -eu
cd "$(dirname "$0")/.."
U=marketing/upload
E=$U/elgato-marketplace
rm -rf "$U"
mkdir -p "$E/gallery" "$U/github/readme" "$U/social" "$U/brand/hero-variants" \
	"$U/brand/icon-variants" "$U/brand/plugin-icons"

pair() { # pair <source.png> <target.png>: copies the PNG and its @2x rendering
	cp "$1" "$2"
	cp "${1%.png}@2x.png" "${2%.png}@2x.png"
}

# Elgato Marketplace
pair marketing/gallery-1-hero.png "$E/thumbnail.png"
pair marketing/marketplace-icon.png "$E/app-icon.png"
pair marketing/gallery-1-hero.png "$E/gallery/01-hero.png"
cp marketing/store-video.mp4 "$E/gallery/02-video-1920x1080.mp4"
pair marketing/gallery-2-faces.png "$E/gallery/03-faces.png"
pair marketing/gallery-5-colors.png "$E/gallery/04-colors.png"
pair marketing/gallery-3-timezones.png "$E/gallery/05-timezones.png"
pair marketing/gallery-4-countdown.png "$E/gallery/06-countdown.png"
cp docs/release/marketplace-listing.md "$E/listing.md"

# GitHub
pair marketing/social-preview.png "$U/github/social-preview.png"
pair docs/images/readme-hero.png "$U/github/readme/readme-hero.png"
cp docs/images/readme-demo.gif docs/images/gif-colors.gif docs/images/gif-countdown.gif "$U/github/readme/"
cp docs/release/github.md "$U/github/repo-settings.md"

# Social posts
cp docs/images/gif-faces.gif docs/images/gif-countdown.gif docs/images/gif-colors.gif \
	marketing/store-video.mp4 "$U/social/"
pair marketing/social-preview.png "$U/social/social-preview.png"

# Brand: all variants and the plugin's own icons
for v in a b c; do
	pair "marketing/hero-variants/hero-$v.png" "$U/brand/hero-variants/hero-$v.png"
	pair "marketing/icon-variants/icon-$v.png" "$U/brand/icon-variants/icon-$v.png"
done
pair marketing/icon-variants/sizes.png "$U/brand/icon-variants/sizes.png"
P=fail.marc.onairclock.sdPlugin/imgs/plugin
cp "$P/icon.png" "$P/icon@2x.png" "$P/category.svg" \
	assets/brand/action-clock.svg assets/brand/action-countdown.svg "$U/brand/plugin-icons/"

# marc.fail handover (untracked, built by the session's media script)
if [ -d marketing/marc-fail ]; then
	mkdir -p "$U/marc-fail"
	cp -R marketing/marc-fail/. "$U/marc-fail/"
fi

# Paste-ready store texts from the listing
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const s = readFileSync("docs/release/marketplace-listing.md", "utf8");
const sec = (h) => { const i = s.indexOf(h) + h.length; const j = s.indexOf("\n## ", i); return s.slice(i, j < 0 ? undefined : j).trim(); };
const en = (h) => /- EN: (.+)/.exec(sec(h))[1];
const E = process.argv[1];
const long = sec("## Long description (EN)");
writeFileSync(`${E}/name.txt`, "On Air Clock\n");
writeFileSync(`${E}/claim.txt`, en("## Claim") + "\n");
writeFileSync(`${E}/short-description.txt`, en("## Short description") + "\n");
writeFileSync(`${E}/description-en.txt`, long + "\n");
writeFileSync(`${E}/description-de-for-blog-and-site.txt`, sec("## Long description (DE)").split("\n").slice(2).join("\n").trim() + "\n");
writeFileSync(`${E}/tags.txt`, sec("## Tags") + "\n");
writeFileSync(`${E}/release-notes.txt`, /```text\n([\s\S]*?)\n```/.exec(sec("## Release notes 2.0.0"))[1] + "\n");
writeFileSync(`${E}/submission-notes.txt`, [
	"Elgato Maker Console, checked against docs.elgato.com/guidelines (2026-11-12)",
	"",
	"- Name: On Air Clock (English, under 30 characters)",
	`- Description: description-en.txt (${long.length} characters, limit 250 to 1500, first 250 plain text incl. requirements)`,
	"- Thumbnail: thumbnail.png (1920 x 960; thumbnail@2x.png is 3840 x 1920 if the console takes it)",
	"- App icon: app-icon.png (288 x 288; app-icon@2x.png is 576 x 576)",
	"- Gallery in this order: gallery/01 ... 06 (PNG 1920 x 960 or the @2x files, video MP4 1920 x 1080 under 250 MB; 3 to 10 items)",
	"- Release notes: release-notes.txt",
	"- AI use must be declared: plugin code, texts and generated artwork were created with AI assistance (Claude) and reviewed by the maintainer.",
	"",
].join("\n"));
' "$E"

cat > "$U/README.txt" <<'TXT'
On Air Clock V2: assets for manual uploads (generated from branch v2, not in git)

Every PNG comes twice: name.png at the platform's size and name@2x.png rendered
at double resolution from the same vector source (sharper on high-density screens).

elgato-marketplace/   thumbnail, app icon, gallery 01-06 (02 is the video), texts to paste,
                      submission notes (incl. the AI declaration), full listing.md
github/               social preview (Settings > Social preview), readme/ images, repo-settings.md
social/               GIFs, store video and social preview for posts
brand/                hero variants A/B/C (A chosen), icon variants A/B/C (B chosen) with
                      size sheet, the plugin's own icons
marc-fail/            blog post draft, product page, NOTES.md, media/ and faces/ (handed to
                      the marc.fail session)

Regenerate: npm run assets && npm run assets:video && npm run assets:light && npm run assets:collect
TXT
echo "collected $(find "$U" -type f | wc -l | tr -d ' ') files into $U"
