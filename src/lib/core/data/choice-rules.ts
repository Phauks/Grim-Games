/**
 * Types and readers for the parts of a character's rules block (`parts/`) about whom it
 * chooses, what its information is like and what the evil team's info steps must remember
 * because of it. The night order's evil
 * info notes (`rules/night-order.ts`) and the Savant's statements (`rules/savant-*.ts`) read
 * them, so neither names a character.
 */
import { checkKeys, describe, isObject, readBoolean, readString, type Issues } from './validate.ts';

/** The evil info steps a note can go on. */
const EVIL_INFO_STEPS = ['minioninfo', 'demoninfo'] as const;
type EvilInfoStep = (typeof EVIL_INFO_STEPS)[number];

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
export interface EvilInfo {
	notes?: Partial<Record<EvilInfoStep, string>>;
	lateNote?: string;
	wakeToken?: string;
	hidesDemon?: true;
	anyPlayerCount?: true;
	hidesMinions?: true;
	shownAsOtherEvil?: true;
	whileWorking?: true;
	none?: true;
}

export const INFO_CARDS = ['secret-word', 'secret-phrase', 'goal'] as const;
export type InfoCard = (typeof INFO_CARDS)[number];

export function readEvilInfo(raw: unknown, path: string, issues: Issues): EvilInfo | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const flags = [
		'hidesDemon',
		'anyPlayerCount',
		'hidesMinions',
		'shownAsOtherEvil',
		'whileWorking',
		'none'
	] as const;
	checkKeys(raw, ['notes', 'lateNote', 'wakeToken', ...flags], path, issues);
	const out: EvilInfo = {};
	for (const flag of flags) if (readBoolean(raw, flag, path, issues)) out[flag] = true;
	const late = readString(raw, 'lateNote', path, issues, false);
	if (late !== undefined) out.lateNote = late;
	const wake = readString(raw, 'wakeToken', path, issues, false);
	if (wake !== undefined) out.wakeToken = wake;
	if (raw.notes !== undefined) {
		const at = `${path}.notes`;
		if (!isObject(raw.notes)) issues.add(at, `expected object, got ${describe(raw.notes)}`);
		else {
			checkKeys(raw.notes, EVIL_INFO_STEPS, at, issues);
			const notes: Partial<Record<EvilInfoStep, string>> = {};
			for (const step of EVIL_INFO_STEPS) {
				const note = readString(raw.notes, step, at, issues, false);
				if (note !== undefined) notes[step] = note;
			}
			out.notes = notes;
		}
	}
	return out;
}
