import { CHARACTER_TYPES, type CharacterType, type ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readBoolean, readEnum, readNumber } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * What being nominated sets off:
 * - `execute-nominator`: the nominator is executed straight away (the Virgin);
 * - `may-kill-nominator`: its player may kill the nominator, an optional kill the Storyteller
 *   confirms once they say so (the Gnome, https://wiki.bloodontheclocktower.com/Gnome);
 * - `evil-swap`: an evil nominator and a living evil nominee, neither a Traveller, swap
 *   characters (The Warrens, https://beardytas.com/garden-of-djinn/the-warrens/);
 * - `nominator-may-die`: the nominator may choose to die, and the nominee's ability then works
 *   twice until the next dusk (The Djinn's Bargain,
 *   https://beardytas.com/garden-of-djinn/the-djinns-bargain/).
 */
const NOMINATED_EFFECTS = [
	'execute-nominator',
	'may-kill-nominator',
	'evil-swap',
	'nominator-may-die'
] as const;
export type NominatedEffect = (typeof NOMINATED_EFFECTS)[number];

/**
 * A nomination that sets off `effect`: of its own player, or with `carrier`, of the player
 * carrying that reminder of the character (the Gnome's Amigo); by a `by` character, or by
 * anyone when left out. With `first`, only the first nomination of that player ever logged
 * sets it off (the Virgin, https://wiki.bloodontheclocktower.com/Virgin). With `minAlive`, only
 * while at least that many players are alive. On a rule source with no player of its own (a
 * Fabled, a Loric, a game mode or a special rule), every nomination sets it off.
 */
export interface OnNominated {
	by?: CharacterType;
	carrier?: ReminderLabel;
	effect: NominatedEffect;
	first?: true;
	minAlive?: number;
}

/**
 * When its player (or the `carrier`) is nominated by a `by` character, `effect` happens (the
 * Virgin, the Gnome). A character with a "No Ability" reminder is spent once that marks it.
 */
export const onNominated = objectPart(
	'On nomination',
	'When its player, or the player with one of its reminders, is nominated, something happens; on a Fabled, Loric or rule, any nomination.',
	(raw, path, issues, reminders): OnNominated | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['by', 'carrier', 'effect', 'first', 'minAlive'], path, issues);
		const by = readEnum(raw, 'by', CHARACTER_TYPES, path, issues, false);
		const carrier = readToken(raw, 'carrier', path, issues, reminders);
		const effect = readEnum(raw, 'effect', NOMINATED_EFFECTS, path, issues, true);
		const minAlive = readNumber(raw, 'minAlive', path, issues);
		const wholeAlive = minAlive === undefined || (Number.isInteger(minAlive) && minAlive >= 0);
		if (!wholeAlive) issues.add(`${path}.minAlive`, 'expected a whole number');
		const ok = (raw.by === undefined || by) && (raw.carrier === undefined || carrier);
		if (!effect || !ok || !wholeAlive) return undefined;
		const first = readBoolean(raw, 'first', path, issues) ? { first: true as const } : {};
		return {
			...(by ? { by } : {}),
			...(carrier ? { carrier } : {}),
			effect,
			...first,
			...(minAlive !== undefined ? { minAlive } : {})
		};
	}
);
