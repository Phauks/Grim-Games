import { anyOf, CHARACTERS, COUNT, obj, oneOf, opt, optObj, T, TOKEN } from '../field-spec.ts';
import { CHARACTER_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * The `wakesWhen` part of a character's rules block: a condition its night step needs before
 * its player wakes, on top of having an ability (`features/grimoire/night/night-steps.ts`):
 * - `deadAtLeastLiving`: the dead equal or outnumber the living (the King,
 *   https://wiki.bloodontheclocktower.com/King);
 * - `deadAtLeast`: at least this many players are dead; with `deadAtLeastLiving` too, either
 *   is enough (with the Leviathan or Riot in play, one dead player wakes the King, M61d);
 * - `diedTonight`: a player who is one of `characters` died tonight, killed `by` the Demon
 *   when given (the Choirboy wakes when the Demon kills the King,
 *   https://wiki.bloodontheclocktower.com/Choirboy);
 * - `diedToday`: on the first night, and on a later night only when a player whose character
 *   type is one of `types` died since the most recent New day, or a player carries the
 *   character's own `token` (the Godfather wakes the night after an Outsider died today,
 *   https://wiki.bloodontheclocktower.com/Godfather);
 * - `nobodyDiedToday`: nobody died since the most recent New day (the Zombuul,
 *   https://wiki.bloodontheclocktower.com/Zombuul);
 * - `untilToken`: until its own reminder is on its player (the Seamstress's No Ability once
 *   its once-per-game ability is used, https://wiki.bloodontheclocktower.com/Seamstress);
 * - `noneMarked`: while no player carries this reminder of its own (the Zombuul does not wake
 *   while anyone is marked Died Today, https://wiki.bloodontheclocktower.com/Zombuul);
 * - `markedDied`: on the first night, and on a later night only once a player carrying this
 *   reminder of its own has died (the Bounty Hunter learns a new evil player when the one
 *   marked Know dies, https://wiki.bloodontheclocktower.com/Bounty_Hunter);
 * - `nightAfterDay`: only on the night after this day, day 1 being the day after the first
 *   night (the Juggler learns on the night after the first day,
 *   https://wiki.bloodontheclocktower.com/Juggler);
 * - `becameToday`: only when its player became this character since the most recent New day,
 *   so never on the first night (the Damsel's step shows the Minions a Damsel made mid-game;
 *   on the first night Minion info shows them, https://wiki.bloodontheclocktower.com/Damsel).
 */
export const wakesWhen = specPart(
	'Wakes when',
	'A condition its player needs before waking for it.',
	optObj({
		deadAtLeastLiving: T,
		deadAtLeast: COUNT,
		diedTonight: obj({ characters: CHARACTERS, by: opt(oneOf(['demon'])) }),
		diedToday: obj({ types: anyOf(CHARACTER_TYPES), token: opt(TOKEN) }),
		nobodyDiedToday: T,
		untilToken: TOKEN,
		noneMarked: TOKEN,
		markedDied: TOKEN,
		nightAfterDay: COUNT,
		becameToday: T
	}),
	(value, path, issues) => {
		const before = issues.list.length;
		if (value.diedTonight?.characters.length === 0) {
			issues.add(`${path}.diedTonight.characters`, 'missing');
		}
		if (value.diedToday?.types.length === 0) issues.add(`${path}.diedToday.types`, 'missing');
		if (Object.keys(value).length === 0) issues.add(path, 'no condition');
		return issues.list.length > before ? undefined : value;
	}
);

export type WakesWhen = PartValue<typeof wakesWhen>;
