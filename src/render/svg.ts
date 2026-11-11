import { DATA_URI_FORMAT, type DataUriFormat } from "../hardware";

export function svgDocument(inner: string, background: string): string {
	const bg =
		background === "none"
			? ""
			: `<rect width="144" height="144" fill="${background}"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">${bg}${inner}</svg>`;
}

export function toDataUriWith(svg: string, format: DataUriFormat): string {
	switch (format) {
		case "base64":
			return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
		case "utf8":
			return `data:image/svg+xml;charset=utf8,${svg}`;
		case "uri":
			return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
	}
}

export function toDataUri(svg: string): string {
	return toDataUriWith(svg, DATA_URI_FORMAT);
}
