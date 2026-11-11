import { BANDS, MARKERS, type Band } from '../../night-placement/bands.ts';
import { optObj, STR, type SpecValue } from '../field-spec.ts';
import type { Issues } from '../validate.ts';
import { specPart } from './part.ts';

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

const PLACE = optObj({ stage: STR, after: STR });

/** A night's place, or why it can't be one, for `night`'s stages. */
function placeOf(
	place: SpecValue<typeof PLACE>,
	path: string,
	issues: Issues,
	night: 'firstNight' | 'otherNight'
): NightPlace | undefined {
	const before = issues.list.length;
	const { stage, after } = place;
	if (stage !== undefined && (!BANDS[night].includes(stage) || MARKERS.includes(stage)))
		issues.add(`${path}.stage`, `not a stage of this night: ${stage}`);
	if (after === '') issues.add(`${path}.after`, 'expected a character id or night marker');
	else if (stage === undefined && after === undefined) issues.add(path, 'expected stage or after');
	return issues.list.length > before ? undefined : (place as NightPlace);
}

export const nightOrder = specPart(
	'Night position',
	'Where its night steps go: right after another character’s step or a night marker.',
	optObj({ first: PLACE, other: PLACE }),
	(value, path, issues): NightOrder | undefined => {
		if (!value.first && !value.other) {
			issues.add(path, 'expected first or other');
			return undefined;
		}
		const first = value.first && placeOf(value.first, `${path}.first`, issues, 'firstNight');
		const other = value.other && placeOf(value.other, `${path}.other`, issues, 'otherNight');
		if ((value.first && !first) || (value.other && !other)) return undefined;
		return { ...(first ? { first } : {}), ...(other ? { other } : {}) };
	}
);
