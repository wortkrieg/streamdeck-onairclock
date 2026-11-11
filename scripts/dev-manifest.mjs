const PROD = "fail.marc.onairclock";
const DEV = `${PROD}.dev`;

const rewrite = (uuid) =>
	uuid.startsWith(PROD) ? DEV + uuid.slice(PROD.length) : uuid;

/**
 * Builds the dev variant of the plugin manifest (own UUIDs, own name), without mutating the input.
 * @param {object} manifest
 * @returns {object}
 */
export function toDevManifest(manifest) {
	const dev = structuredClone(manifest);
	dev.UUID = rewrite(dev.UUID);
	dev.Name = `${manifest.Name} (Dev)`;
	for (const action of dev.Actions ?? []) {
		action.UUID = rewrite(action.UUID);
	}
	return dev;
}
