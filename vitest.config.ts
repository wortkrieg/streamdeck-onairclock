import { defineConfig } from "vitest/config";

export default defineConfig({
	define: {
		__PLUGIN_UUID__: JSON.stringify("fail.marc.onairclock"),
	},
	test: {
		env: { TZ: "Europe/Berlin" },
		globals: true,
		include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
	},
});
