import { spawnSync } from "node:child_process";
import {
	cpSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toDevManifest } from "./dev-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "fail.marc.onairclock.sdPlugin");
const dest = path.join(root, "build", "fail.marc.onairclock.dev.sdPlugin");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, {
	recursive: true,
	filter: (file) => {
		const rel = path.relative(src, file);
		return rel !== "bin" && !rel.startsWith(`bin${path.sep}`) && rel !== "logs";
	},
});

const manifest = JSON.parse(
	readFileSync(path.join(src, "manifest.json"), "utf8"),
);
writeFileSync(
	path.join(dest, "manifest.json"),
	`${JSON.stringify(toDevManifest(manifest), null, "\t")}\n`,
);

const result = spawnSync("npx", ["rollup", "-c"], {
	cwd: root,
	stdio: "inherit",
	env: { ...process.env, ONAIR_DEV: "1" },
});
process.exit(result.status ?? 1);
