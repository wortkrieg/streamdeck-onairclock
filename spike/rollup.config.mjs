import path from "node:path";
import url from "node:url";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const sdPlugin = "spike/fail.marc.onairclock.spike.sdPlugin";

/** @type {import('rollup').RollupOptions} */
export default {
	input: "spike/plugin.ts",
	output: {
		file: `${sdPlugin}/bin/plugin.js`,
		sourcemapPathTransform: (rel, map) =>
			url.pathToFileURL(path.resolve(path.dirname(map), rel)).href,
	},
	plugins: [
		typescript({ tsconfig: "spike/tsconfig.json" }),
		nodeResolve({
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true,
		}),
		commonjs(),
		{
			name: "emit-module-package-file",
			generateBundle() {
				this.emitFile({
					fileName: "package.json",
					source: `{ "type": "module" }`,
					type: "asset",
				});
			},
		},
	],
};
