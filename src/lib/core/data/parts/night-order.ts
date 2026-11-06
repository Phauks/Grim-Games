import { BANDS, MARKERS, type Band } from '../../night-placement/bands.ts';
import { checkKeys, describe, isObject, readString, type Issues } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * Where its step goes on one night: in a stage of the night (`night-placement/bands.ts`), right
 * after a step (a character id or a night marker). The stage never depends on who is in play,
 * so it places the step when `after` names a character the game doesn't know.
 */
export interface NightPlace {
	stage?: Band;
	after?: string;
}

/**
 * Where its night steps go (M59): on the first night and on other nights, in a stage of the
 * night and right after the step of another character or a night marker (`dusk`, `minioninfo`,
 * `demoninfo`, `dawn`). A step
 * after `dawn` is an announcement made as the day begins. TPI's night sheet still wins for a
 * character it lists; this places one it doesn't (a custom character), and every official
 * character has it too, written from the sheet.
 */
export interface NightOrder {
	first?: NightPlace;
	other?: NightPlace;
}

function readPlace(
	raw: unknown,
	path: string,
	issues: Issues,
	night: 'firstNight' | 'otherNight'
): NightPlace | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['stage', 'after'], path, issues);
	const out: NightPlace = {};
	const errors = issues.list.length;
	const stage = readString(raw, 'stage', path, issues, false);
	if (stage !== undefined) {
		if (BANDS[night].includes(stage) && !MARKERS.includes(stage)) out.stage = stage as Band;
		else issues.add(`${path}.stage`, `not a stage of this night: ${stage}`);
	}
	const after = readString(raw, 'after', path, issues, false);
	if (after === '') issues.add(`${path}.after`, 'expected a character id or night marker');
	else if (after !== undefined) out.after = after;
	if (issues.list.length === errors && !out.stage && !out.after)
		issues.add(path, 'expected stage or after');
	return issues.list.length === errors ? out : undefined;
}

export const nightOrder = objectPart(
	'Night position',
	'Where its night steps go: right after another character’s step or a night marker.',
	(raw, path, issues): NightOrder | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['first', 'other'], path, issues);
		const out: NightOrder = {};
		let ok = true;
		for (const night of ['first', 'other'] as const) {
			if (raw[night] === undefined) continue;
			const place = readPlace(
				raw[night],
				`${path}.${night}`,
				issues,
				night === 'first' ? 'firstNight' : 'otherNight'
			);
			if (place) out[night] = place;
			else ok = false;
		}
		if (ok && !out.first && !out.other) {
			issues.add(path, 'expected first or other');
			ok = false;
		}
		return ok ? out : undefined;
	}
);
