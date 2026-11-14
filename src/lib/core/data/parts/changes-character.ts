import { anyOf, CHARACTERS, COUNT, obj, oneOf, opt, T, TOKEN } from '../field-spec.ts';
import { ALIGNMENTS, SEATED_TYPES } from '../types.ts';
import { specPart, partWords } from './part.ts';

/**
 * On its night step, this character's living player chooses a
 * player who becomes a character the step then picks. It names a behaviour, never a
 * character's rules:
 * - `types`: the character types that may be picked;
 * - `notInPlay`: only characters no one is playing (the Pit-Hag,
 *   https://wiki.bloodontheclocktower.com/Pit-Hag);
 * - `notTravellers`: never a Traveller (the Pit-Hag; its wiki page calls changing a
 *   Traveller an optional rule the Storyteller may allow, so its optional rule leaves this out);
 * - `alignment`: the player's new alignment; left out, they keep theirs (the Summoner's
 *   "evil Demon", https://wiki.bloodontheclocktower.com/Summoner);
 * - `token`: only on a night its own token marks (the Summoner's Night 3);
 * - `spent`: not once its own token says it was used (the Huntsman's No Ability);
 * - `onlyFrom`: only a player of one of these characters changes (the Huntsman's Damsel,
 *   https://wiki.bloodontheclocktower.com/Huntsman);
 * - `notMarked`: never the player its own token marks (the Cacklejack's Not Me, chosen by
 *   day, https://wiki.bloodontheclocktower.com/Cacklejack);
 * - `sameType`: each player of one of `types` may change, into another character of their own
 *   type (the Hatter's tea party, https://wiki.bloodontheclocktower.com/Hatter; the Engineer,
 *   https://wiki.bloodontheclocktower.com/Engineer). A character
 *   whose rules say it acts when dead (`actsWhenDead`) offers it from a dead player too;
 * - `anyType`: with `sameType`, the player may pick a character of any of `types`, not only
 *   their own (the Hatter's optional rule: the Demon may become a Minion and a Minion the
 *   Demon);
 * - `afterDeath`: only once its own player has died (the Hatter's tea party, "If the Hatter
 *   dies"); the night step's own wake rule (`onDeath`) keeps it to the night they died;
 * - `firstNight`: only on the first night (the Kazali,
 *   https://wiki.bloodontheclocktower.com/Kazali);
 * - `upTo: 'minions'`: one player after another until there are as many Minions as the
 *   player count usually has (the Kazali's Minions); a player already of one of `types` is not
 *   offered;
 * - `extraMinions`: with `upTo`, that many Minions more than usual (the Lord of Typhon's
 *   "+1 Minion", https://wiki.bloodontheclocktower.com/Lord_of_Typhon);
 * - `minMinions`: with `upTo`, only when the player count usually has at least this many
 *   Minions (the Marionette's "if there are three Minions", one more is made on the first
 *   night, https://wiki.bloodontheclocktower.com/Marionette);
 * - `outward`: only the nearest player on each side of its own player who is not yet of
 *   `types`, so the new Minions spread out from it in a line (the Lord of Typhon's
 *   neighbours).
 */
export const changesCharacter = partWords(
	specPart(
		'night',
		'Changes character',
		'Its night step makes a chosen player another character.',
		obj({
			types: anyOf(SEATED_TYPES),
			notInPlay: opt(T),
			notTravellers: opt(T),
			alignment: opt(oneOf(ALIGNMENTS)),
			token: opt(TOKEN),
			spent: opt(TOKEN),
			onlyFrom: opt(CHARACTERS),
			notMarked: opt(TOKEN),
			sameType: opt(T),
			anyType: opt(T),
			afterDeath: opt(T),
			firstNight: opt(T),
			upTo: opt(oneOf(['minions'])),
			extraMinions: opt(COUNT),
			minMinions: opt(COUNT),
			outward: opt(T)
		}),
		(value, path, issues) => {
			const before = issues.list.length;
			if (!value.types.length) issues.add(`${path}.types`, 'expected at least one character type');
			if (value.anyType && !value.sameType) issues.add(`${path}.anyType`, 'only with sameType');
			for (const key of ['extraMinions', 'minMinions'] as const) {
				if (value[key] !== undefined && !value.upTo) issues.add(`${path}.${key}`, 'only with upTo');
			}
			return issues.list.length > before ? undefined : value;
		}
	),
	{
		types: {
			label: 'New character’s types'
		},
		notInPlay: {
			label: 'Only characters not in play'
		},
		notTravellers: {
			label: 'Never a Traveller'
		},
		alignment: {
			label: 'New alignment',
			about: 'Left empty, the player keeps theirs.'
		},
		token: {
			label: 'Only on the night of',
			about: 'Only on a night its own reminder marks.'
		},
		spent: {
			label: 'Used up by',
			about: 'Not once this reminder of its own is on its player.'
		},
		onlyFrom: {
			label: 'Only players of',
			about: 'Only a player of one of these characters changes.'
		},
		notMarked: {
			label: 'Never the player with',
			about: 'Never the player this reminder of its own marks.'
		},
		sameType: {
			label: 'Each into their own type',
			about: 'Each player of these types may change into another character of their type.'
		},
		anyType: {
			label: 'Into any of the types',
			about: 'With each into their own type: any of the types, not only their own.'
		},
		afterDeath: {
			label: 'Only once its player has died'
		},
		firstNight: {
			label: 'Only on the first night'
		},
		upTo: {
			label: 'One after another until',
			names: {
				minions: 'The usual number of Minions'
			}
		},
		extraMinions: {
			label: 'Minions more than usual'
		},
		minMinions: {
			label: 'Only with at least this many Minions',
			about: 'The usual number of Minions for the player count.'
		},
		outward: {
			label: 'Outward from its player',
			about: 'Only the nearest player each side not yet of these types.'
		}
	}
);
