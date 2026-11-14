import { obj, oneOf, TOKEN } from '../field-spec.ts';
import { specPart, type PartValue, partWords } from './part.ts';

export const DAY_MARKS = ['demon-voted', 'minion-nominated'] as const;
export type DayMark = (typeof DAY_MARKS)[number];

/**
 * A yes-or-no fact about today that the Storyteller marks by hand, because the app does not
 * track it, and that a character learns at night: the `dayMark` part of its rules block, read
 * here and used by `rules/day/day-marks.ts`, the day view and End day.
 *
 * - `mark`: which fact (`DAY_MARKS`): `demon-voted` (the Flowergirl,
 *   https://wiki.bloodontheclocktower.com/Flowergirl) or `minion-nominated` (the Town Crier,
 *   https://wiki.bloodontheclocktower.com/Town_Crier);
 * - `yes`, `no`: the character's own reminder tokens that show the fact on its seat. Marking
 *   the fact places the matching one and takes the other off, as the wiki's How to Run does
 *   with the two tokens each day.
 *
 * While such a character is in play, End day asks for any of today's marks still unset.
 */
export const dayMark = partWords(
	specPart(
		'day',
		'Day mark',
		'A fact about today the Storyteller marks for its night answer.',
		obj({ mark: oneOf(DAY_MARKS), yes: TOKEN, no: TOKEN }),
		(value, path, issues) => {
			if (value.yes !== value.no) return value;
			issues.add(`${path}.no`, 'the same token as yes');
			return undefined;
		}
	),
	{
		mark: {
			label: 'Fact',
			names: {
				'demon-voted': 'The Demon voted',
				'minion-nominated': 'A Minion nominated'
			}
		},
		yes: {
			label: 'Reminder for yes'
		},
		no: {
			label: 'Reminder for no'
		}
	}
);

export type DayMarkRule = PartValue<typeof dayMark>;
