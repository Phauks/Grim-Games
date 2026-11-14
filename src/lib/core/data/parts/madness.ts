import { obj, oneOf, opt, TOKEN } from '../field-spec.ts';
import { specPart, type PartValue, partWords } from './part.ts';

export const MADNESS_BREAKING = ['execution', 'death'] as const;
export type MadnessBreaking = (typeof MADNESS_BREAKING)[number];
export const MADNESS_CHOSEN_BY = ['nominee'] as const;
export type MadnessChosenBy = (typeof MADNESS_CHOSEN_BY)[number];

/**
 * The `madness` part of a character's rules block: a player its ability makes "mad" may be
 * executed or die if the Storyteller judges they broke their madness
 * (https://wiki.bloodontheclocktower.com/Madness), so the day view offers that when they do
 * (`rules/day/madness.ts`). It names a behaviour, never a character:
 * - `token`: the reminder that marks the mad player; without it, this character's own player
 *   is mad (the Mutant, https://wiki.bloodontheclocktower.com/Mutant);
 * - `breaking`: `execution`, the mad player might be executed (the Cerenovus,
 *   https://wiki.bloodontheclocktower.com/Cerenovus), or `death`, they might die (the Harpy,
 *   https://wiki.bloodontheclocktower.com/Harpy);
 * - `alsoDies`: with `death`, the reminder on a second player who might die instead or as
 *   well (the Harpy's 2nd);
 * - `chosenBy: 'nominee'`: instead of a token, the mad player is whoever a nominee chose today,
 *   recorded on the nomination (the Big Wig's speaker,
 *   https://wiki.bloodontheclocktower.com/Big_Wig); the board asks the nominee's choice when a
 *   nomination is recorded.
 */
export const madness = partWords(
	specPart(
		'day',
		'Madness',
		'A player it makes mad may be executed or die for breaking it.',
		obj({
			token: opt(TOKEN),
			breaking: oneOf(MADNESS_BREAKING),
			alsoDies: opt(TOKEN),
			chosenBy: opt(oneOf(MADNESS_CHOSEN_BY))
		}),
		(value, path, issues) => {
			const before = issues.list.length;
			if (value.alsoDies && value.breaking !== 'death') {
				issues.add(`${path}.alsoDies`, 'only with breaking "death"');
			}
			if (value.chosenBy && value.token) {
				issues.add(`${path}.chosenBy`, 'a token or chosenBy, not both');
			}
			return issues.list.length > before ? undefined : value;
		}
	),
	{
		token: {
			label: 'Marks the mad player',
			about: 'Left empty, its own player is mad.'
		},
		breaking: {
			label: 'Breaking it means',
			names: {
				execution: 'Might be executed',
				death: 'Might die'
			}
		},
		alsoDies: {
			label: 'Or the player with',
			about: 'A second player who might die instead or as well.'
		},
		chosenBy: {
			label: 'Mad player chosen by',
			names: {
				nominee: 'Today’s nominee'
			}
		}
	}
);

export type Madness = PartValue<typeof madness>;
