import { anyOf, obj, oneOf, opt, T, TOKEN, TOKENS } from '../field-spec.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart, type PartValue, partWords } from './part.ts';

export const GIVES_ABILITY_TO = ['demon', 'storyteller', 'self'] as const;
export type GivesAbilityTo = (typeof GIVES_ABILITY_TO)[number];

/**
 * The `givesAbility` part of a character's rules block: it gives another player an ability
 * they hold without its token (`Seat.abilities`, `rules/abilities/gained-abilities.ts`). The
 * Storyteller picks the ability from the seat's ⋯ menu. It names a behaviour, never a
 * character:
 * - `to`: who holds it; `demon`, the Demon in play (the Boffin,
 *   https://wiki.bloodontheclocktower.com/Boffin), `storyteller`, the Storyteller, who
 *   makes its choices (the Plague Doctor, picked on its night step once it dies,
 *   https://wiki.bloodontheclocktower.com/Plague_Doctor), or `self`, this character's own
 *   player (the Hermit, https://wiki.bloodontheclocktower.com/Hermit; picked from its own ⋯
 *   menu without `onScript`: the character whose ability the Amnesiac's works like, for its
 *   night timing, text and reminders, https://wiki.bloodontheclocktower.com/Amnesiac);
 * - `types`: the character types the ability may come from;
 * - `onScript`: every other character of those types on the script, all at once, with
 *   nothing to pick (the Hermit's Outsiders);
 * - `notInPlay`: only a character not in play;
 * - `token`: its reminder that marks the held ability on the board (the Plague Doctor's
 *   Storyteller Ability);
 * - `whileWorks`: the holder has it only while this character's ability works, so not while
 *   its player is dead, drunk or poisoned (the Boffin's Summary on the wiki);
 * - `setup`: the setup change in brackets on the given ability is made, as if its character
 *   were in play (the Boffin's How to Run: the Demon's two abilities change setup);
 * - `standIns`: this character's own reminders that stand in for the given abilities' tokens
 *   (the Hermit's 1, 2 and 3). The app gives each holder its own copies of the real tokens
 *   instead (M68, Trevor 2026-11-06), so it never offers these.
 */
export const givesAbility = partWords(
	specPart(
		'abilities',
		'Gives an ability',
		'It gives another player an ability held without its token.',
		obj({
			to: oneOf(GIVES_ABILITY_TO),
			types: anyOf(SEATED_TYPES),
			notInPlay: opt(T),
			onScript: opt(T),
			token: opt(TOKEN),
			whileWorks: opt(T),
			setup: opt(T),
			standIns: opt(TOKENS)
		}),
		(value, path, issues) => {
			if (value.types.length === 0) {
				issues.add(`${path}.types`, 'expected at least one character type');
				return undefined;
			}
			if (value.onScript && value.to !== 'self') {
				issues.add(`${path}.onScript`, 'only with "to": "self"');
				return undefined;
			}
			return value;
		}
	),
	{
		to: {
			label: 'Given to',
			names: {
				demon: 'The Demon',
				storyteller: 'The Storyteller',
				self: 'Its own player'
			}
		},
		types: {
			label: 'From these types'
		},
		notInPlay: {
			label: 'Only characters not in play'
		},
		onScript: {
			label: 'Every one on the script',
			about: 'All at once, nothing to pick.'
		},
		token: {
			label: 'Marked by'
		},
		whileWorks: {
			label: 'Only while its ability works'
		},
		setup: {
			label: 'Makes its setup change'
		},
		standIns: {
			label: 'Stand-in reminders',
			about: 'Never offered: each holder gets copies of the real reminders.'
		}
	}
);

export type GivesAbility = PartValue<typeof givesAbility>;
