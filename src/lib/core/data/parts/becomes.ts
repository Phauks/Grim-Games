import { obj, oneOf, opt, T, TOKEN } from '../field-spec.ts';
import { specPart, partWords } from './part.ts';

/**
 * The `becomes` part of a character's rules block: its reminder token says a player changed
 * character or alignment, so the board offers to make that change (`rules/abilities/becomes.ts`). It
 * names a behaviour, never a character:
 * - `demon`: the carrier becomes the Demon in play, the dead one first, and is evil (the
 *   Scarlet Woman's Is The Demon, https://wiki.bloodontheclocktower.com/Scarlet_Woman);
 * - `evil`: the carrier turns evil (the Mezepheles's Turns Evil, taken off on the night they
 *   turn, https://wiki.bloodontheclocktower.com/Mezepheles);
 * - `swap`: a Demon carrier swaps characters and alignments with this character's player (the
 *   Snake Charmer's Poisoned on the Demon it chose,
 *   https://wiki.bloodontheclocktower.com/Snake_Charmer);
 * - `carrier-alignment`: this character's player takes the carrier's alignment (the Goon's
 *   Drunk on the first player to choose it, https://wiki.bloodontheclocktower.com/Goon; the
 *   Ogre's Friend, https://wiki.bloodontheclocktower.com/Ogre).
 *
 * `when` is the moment the token says so: `placed` (the default) or `removed`. `follows`, with
 * `carrier-alignment`: whenever the carrier's alignment changes later, this character's player
 * takes the new one too (the Ogre's optional rule: always the friend's alignment).
 *
 * The change happens only while this character's player has a working ability (a drunk
 * Mezepheles turns nobody evil, https://wiki.bloodontheclocktower.com/Mezepheles), unless
 * `evenIfImpaired` (the Ogre becomes its friend's alignment even if drunk or poisoned). `spent`:
 * not once this own token is on this character's player (a Mezepheles marked No Ability turns
 * no one else evil).
 */
export const becomes = partWords(
	specPart(
		'abilities',
		'Becomes',
		'Its token says a player changed character or alignment.',
		obj({
			token: TOKEN,
			into: oneOf(['demon', 'evil', 'swap', 'carrier-alignment']),
			when: opt(oneOf(['placed', 'removed'])),
			follows: opt(T),
			evenIfImpaired: opt(T),
			spent: opt(TOKEN)
		}),
		(value, path, issues) => {
			if (!value.follows || value.into === 'carrier-alignment') return value;
			issues.add(`${path}.follows`, 'only with into "carrier-alignment"');
			return undefined;
		}
	),
	{
		token: {
			label: 'Reminder'
		},
		into: {
			label: 'What changes',
			names: {
				demon: 'The marked player becomes the Demon',
				evil: 'The marked player turns evil',
				swap: 'A marked Demon swaps with its player',
				'carrier-alignment': 'Its player takes the marked player’s alignment'
			}
		},
		when: {
			label: 'When',
			names: {
				placed: 'When placed',
				removed: 'When taken off'
			}
		},
		follows: {
			label: 'Keeps following their alignment'
		},
		evenIfImpaired: {
			label: 'Even if drunk or poisoned'
		},
		spent: {
			label: 'Used up by'
		}
	}
);
