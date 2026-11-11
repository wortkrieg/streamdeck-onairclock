import { toDevManifest } from "./dev-manifest.mjs";

const prod = {
	UUID: "fail.marc.onairclock",
	Name: "On Air Clock",
	Actions: [
		{ UUID: "fail.marc.onairclock.action" },
		{ UUID: "fail.marc.onairclock.countdown" },
	],
};

test("rewrites plugin and action UUIDs and name", () => {
	const dev = toDevManifest(prod);
	expect(dev.UUID).toBe("fail.marc.onairclock.dev");
	expect(dev.Name).toBe("On Air Clock (Dev)");
	expect(dev.Actions.map((a) => a.UUID)).toEqual([
		"fail.marc.onairclock.dev.action",
		"fail.marc.onairclock.dev.countdown",
	]);
	expect(prod.UUID).toBe("fail.marc.onairclock"); // input not mutated
});
