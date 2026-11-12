import type { FaceModel } from "../../core/clock-model";
import type { FaceId } from "../../core/settings";
import { r2 } from "../geometry";
import { svgDocument } from "../svg";
import { renderBig } from "./big";
import { renderClassic } from "./classic";
import { renderComet } from "./comet";
import { renderLine } from "./line";
import { renderModern } from "./modern";
import {
	type AnimState,
	type FaceRenderer,
	type FaceStyle,
	FLASH_OPACITY,
	GLOW_ID,
	glowDefs,
} from "./shared";

export { type AnimState, type FaceStyle, STATIC_ANIM } from "./shared";

const FACES: Readonly<Record<FaceId, FaceRenderer>> = {
	classic: renderClassic,
	modern: renderModern,
	line: renderLine,
	comet: renderComet,
	big: renderBig,
};

/** One complete 144x144 SVG document for a face. */
export function renderFace(
	face: FaceId,
	m: FaceModel,
	s: FaceStyle,
	a: AnimState,
): string {
	const body = (FACES[face] ?? renderClassic)(m, s, a);
	const defs = body.includes(`url(#${GLOW_ID})`) ? glowDefs(s.active) : "";
	const flash = a.flash
		? `<rect width="144" height="144" fill="${s.active}" opacity="${FLASH_OPACITY}"/>`
		: "";
	const content =
		a.pulse !== 1 ? `<g opacity="${r2(a.pulse)}">${body}</g>` : body;
	return svgDocument(defs + flash + content, s.background);
}
