import { obj, oneOf, opt, T, TOKEN } from '../field-spec.ts';
import { ALIGNMENTS, CHARACTER_TYPES } from '../types.ts';
import { specPart, type PartValue, partWords } from './part.ts';

/**
 * When a player dies by execution, the ability's `token` goes on the board by itself, while
 * the ability's player lives (or acts when dead); on its own player, only while the ability
 * works. A Traveller's exile is
 * not an execution, so it never sets it off.
 * - `of`, `alignment`: only an executed player of this character type, or this alignment
 *   (the Minstrel's Minion, the Leviathan's good player); either or both may be left out.
 * - `on`: where the token goes: its own player (left out: the Minstrel's Everyone Is Drunk), or
 *   `executed`, the executed player (the Undertaker's Died Today, the Cannibal's Lunch). Then
 *   the ability's own player may be the one executed.
 * - `moves`: with `on: executed`, a token already out moves to the new executed player (the
 *   Cannibal's Lunch); without it, a token already out stays and none is added (the
 *   Leviathan's first Good Player Executed).
 * - `when: day`: any death during the day counts, not only an execution (the Godfather's
 *   Outsider who dies during the day, the Zombuul's Died Today).
 * - `marksSelf`: with `on: executed`, its own `token` also goes on its own player when the
 *   executed player has this `alignment`, and comes off when they don't (the Cannibal's
 *   Poisoned after an evil lunch).
 */
export const afterExecution = partWords(
	specPart(
		'day',
		'After an execution',
		'Its token goes on its player, or on the executed player, when a player dies by execution.',
		obj({
			of: opt(oneOf(CHARACTER_TYPES)),
			alignment: opt(oneOf(ALIGNMENTS)),
			token: TOKEN,
			on: opt(oneOf(['executed'])),
			moves: opt(T),
			marksSelf: opt(obj({ token: TOKEN, alignment: oneOf(ALIGNMENTS) })),
			when: opt(oneOf(['day']))
		}),
		(value, path, issues) => {
			if (value.on) return value;
			const loose = (['moves', 'marksSelf'] as const).filter((key) => value[key] !== undefined);
			for (const key of loose) issues.add(`${path}.${key}`, 'only with "on": "executed"');
			return loose.length ? undefined : value;
		}
	),
	{
		of: {
			label: 'Only an executed player of this type'
		},
		alignment: {
			label: 'Only an executed player of this alignment'
		},
		token: {
			label: 'Reminder'
		},
		on: {
			label: 'Goes on',
			about: 'Left empty, it goes on its own player.',
			names: {
				executed: 'The executed player'
			}
		},
		moves: {
			label: 'Moves to the next executed player',
			about: 'Otherwise a reminder already out stays, and none is added.'
		},
		marksSelf: {
			label: 'Also marks its own player',
			about: 'When the executed player has this alignment.'
		},
		'marksSelf.token': {
			label: 'Reminder'
		},
		'marksSelf.alignment': {
			label: 'When the executed player is'
		},
		when: {
			label: 'Counts',
			names: {
				day: 'Any death by day'
			}
		}
	}
);

export type AfterExecution = PartValue<typeof afterExecution>;
