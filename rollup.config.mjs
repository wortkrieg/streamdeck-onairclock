import path from "node:path";
import url from "node:url";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const isWatching = !!process.env.ROLLUP_WATCH;
const isDev = !!process.env.ONAIR_DEV;
const pluginUuid = isDev ? "fail.marc.onairclock.dev" : "fail.marc.onairclock";
const sdPlugin = isDev
	? `build/${pluginUuid}.sdPlugin`
	: `${pluginUuid}.sdPlugin`;

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
	input: "src/plugin.ts",
	output: {
		file: `${sdPlugin}/bin/plugin.js`,
		sourcemap: isWatching,
		sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
			return url.pathToFileURL(
				path.resolve(path.dirname(sourcemapPath), relativeSourcePath),
			).href;
		},
	},
	plugins: [
		{
			name: "watch-externals",
			buildStart: function () {
				this.addWatchFile(`${sdPlugin}/manifest.json`);
			},
		},
		replace({
			preventAssignment: true,
			values: { __PLUGIN_UUID__: JSON.stringify(pluginUuid) },
		}),
		typescript({
			mapRoot: isWatching ? "./" : undefined,
		}),
		nodeResolve({
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true,
		}),
		commonjs(),
		!isWatching && terser(),
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

export default config;
