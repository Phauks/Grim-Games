import { optObj, T, TOKEN } from '../field-spec.ts';
import { specPart, type PartValue, partWords } from './part.ts';

/**
 * Who is woken and shown this character's token, in its own night step: every Minion (the
 * Damsel, also at Minion info, https://wiki.bloodontheclocktower.com/Damsel), or the player
 * carrying its `carrier` reminder (the Widow's Know,
 * https://wiki.bloodontheclocktower.com/Widow).
 */
export const shownTo = partWords(
	specPart(
		'night',
		'Shown to',
		'Who is woken and shown this character’s token.',
		optObj({ minions: T, carrier: TOKEN }),
		(value, path, issues) => {
			if (value.minions || value.carrier) return value;
			issues.add(path, 'expected minions or carrier');
			return undefined;
		}
	),
	{
		minions: {
			label: 'Every Minion'
		},
		carrier: {
			label: 'Player with',
			about: 'The player carrying this reminder of its own.'
		}
	}
);

export type ShownTo = PartValue<typeof shownTo>;
