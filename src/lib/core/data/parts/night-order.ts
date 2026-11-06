import { checkKeys, describe, isObject, readString, type Issues } from '../validate.ts';
import { objectPart } from './part.ts';

/** Where its step goes on one night: right after this step (a character id or a night marker). */
export interface NightPlace {
	after: string;
}

/**
 * Where its night steps go (M59): on the first night and on other nights, right after the step
 * of another character or a night marker (`dusk`, `minioninfo`, `demoninfo`, `dawn`). A step
 * after `dawn` is an announcement made as the day begins. TPI's night sheet still wins for a
 * character it lists; this places one it doesn't (a custom character), and every official
 * character has it too, written from the sheet.
 */
export interface NightOrder {
	first?: NightPlace;
	other?: NightPlace;
}

function readPlace(raw: unknown, path: string, issues: Issues): NightPlace | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['after'], path, issues);
	const after = readString(raw, 'after', path, issues, true);
	if (after === '') issues.add(`${path}.after`, 'expected a character id or night marker');
	return after ? { after } : undefined;
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
			const place = readPlace(raw[night], `${path}.${night}`, issues);
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
