import { optObj, ownWords, STR, T, TOKEN } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * How it changes the Minion and Demon info steps: a note to remember at each step while it is
 * in play (the Snitch's extra bluffs at Demon info), and `hidesDemon` when a Minion may not
 * learn the Demon because of it (the Poppy Grower, Magician, Marionette, Lil' Monsta).
 * `anyPlayerCount` gives the steps below 7 players too (the Toymaker: evil players get normal
 * starting info, https://wiki.bloodontheclocktower.com/Toymaker). `hidesMinions` while a player
 * with it lives: the Demon learns no Minions (the Poppy Grower,
 * https://wiki.bloodontheclocktower.com/Poppy_Grower); with `whileWorking`, only while its
 * ability works, so a drunk or poisoned one hides nothing (its optional rule).
 * `shownAsOtherEvil`: the Demon is shown
 * its player as a Minion and the Minions as the Demon (the Magician,
 * https://wiki.bloodontheclocktower.com/Magician). `none` leaves both steps out at any player
 * count (Tor: the Demon and Minions do not know each other,
 * https://wiki.bloodontheclocktower.com/Tor; Lil' Monsta, whose own step wakes the Minions
 * instead, https://wiki.bloodontheclocktower.com/Lil%27_Monsta). `lateNote`: what to do on the night it comes
 * into play after the first night, on the step that wakes its new player (a Snitch the
 * Pit-Hag makes: each Minion learns 3 bluffs that night, https://wiki.bloodontheclocktower.com/Snitch).
 * `wakeToken`: one of its reminders; on a night after the first while it is on a player, the
 * Minion info and Demon info steps come back (`late-evil-info.ts`; the Poppy Grower's Evil Wakes).
 */
export const evilInfo = specPart(
	'night',
	'Evil info steps',
	'How it changes the Minion and Demon info steps.',
	optObj({
		notes: ownWords(optObj({ minioninfo: STR, demoninfo: STR })),
		lateNote: ownWords(STR),
		wakeToken: TOKEN,
		hidesDemon: T,
		anyPlayerCount: T,
		hidesMinions: T,
		shownAsOtherEvil: T,
		whileWorking: T,
		none: T
	})
);

export type EvilInfo = PartValue<typeof evilInfo>;
