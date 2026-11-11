import { defineConfig } from "vitest/config";

export default defineConfig({
	define: {
		__PLUGIN_UUID__: JSON.stringify("fail.marc.onairclock"),
	},
	test: {
		globals: true,
		include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
	},
});
