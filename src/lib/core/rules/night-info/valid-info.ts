/**
 * Night information: every valid piece of information for an info picker, grouped for
 * display. Part of `picker.ts`.
 */
import type { Learns } from '#lib/core/data/character-rules.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import type { InfoOption, InfoPicker } from './picker.ts';

/** Why a piece of information is valid to show. */
export type ValidReason =
	/** True as the grimoire stands. */
	| 'true'
	/** True if the `registered` players register as something else (Spy, Recluse). */
	| 'registers'
	/** Any information is allowed: the waking player is drunk, poisoned or has no ability. */
	| 'unreliable'
	/** Any information is allowed: the Storyteller may break the rules (the Atheist). */
	| 'any'
	/** The Vortox: only false information is allowed. */
	| 'vortox';

/**
 * One piece of information the Storyteller may show. Every valid one is listed; the app
 * never picks one for them (Trevor, 2026-10-18: "don't give a single suggestion, just show
 * all valid information").
 */
export interface ValidInfo {
	reason: ValidReason;
	/** For `registers`: the players who would have to register otherwise. */
	registered?: SeatId[];
	/** A number (Chef, Empath, Clockmaker; the Librarian's 0). */
	number?: number;
	yes?: boolean;
	none?: boolean;
	/** For a pair: the character, or any of these characters, that may be shown. */
	characterIds?: CharacterId[];
	/** For a pair: the player who is that character. */
	target?: SeatId;
	/**
	 * The players: for a pair, every player who may be shown beside `target`; otherwise the
	 * players the information is about (Fortune Teller's pair, Steward's or Noble's choice).
	 */
	seats: SeatId[];
	/** Any other choice is valid too, for `unreliable`, `any` or `vortox` (too many to list). */
	anyOther?: boolean;
}

/** The highest number a number picker could show, for listing every valid one. */
function highestNumber(game: Game, measure: Learns['measure']): number {
	const n = game.seating.length;
	if (measure === 'evil-alive-neighbours' || measure === 'woke-tonight') return 2;
	if (measure === 'demon-minion-steps') return Math.max(1, Math.floor(n / 2));
	return n;
}

/**
 * Every valid piece of information for a picker, grouped for display: the true ones first,
 * then those true only by registration, then what droisoning or the Vortox allows. Pairs
 * are grouped by the shown character and its player, listing every possible second player.
 */
export function validInformation(game: Game, picker: InfoPicker): ValidInfo[] {
	const reasonOf = (o: InfoOption): Pick<ValidInfo, 'reason' | 'registered'> =>
		o.registered ? { reason: 'registers', registered: o.registered } : { reason: 'true' };
	// Under the Vortox the truthful options are exactly the ones not allowed.
	const truthful: ValidInfo[] = picker.mustBeFalse && !picker.unreliable ? [] : groupOptions();
	const extra: ValidInfo[] = [];
	const loose: ValidReason | undefined = picker.unreliable
		? 'unreliable'
		: picker.anyBy
			? 'any'
			: picker.mustBeFalse
				? 'vortox'
				: undefined;
	if (loose) {
		if (picker.kind === 'number') {
			const taken = new Set(truthful.map((v) => v.number));
			const notTrue = new Set(picker.options.map((o) => o.number));
			for (
				let n = picker.measure === 'demon-minion-steps' ? 1 : 0;
				n <= highestNumber(game, picker.measure);
				n++
			) {
				if (taken.has(n)) continue;
				if (loose === 'vortox' && notTrue.has(n)) continue;
				extra.push({ reason: loose, number: n, seats: [] });
			}
		} else {
			extra.push({ reason: loose, seats: [], anyOther: true });
		}
	}
	return [...truthful, ...extra];

	function groupOptions(): ValidInfo[] {
		if (picker.kind !== 'pair-character') {
			return picker.options.map((o) => ({
				...reasonOf(o),
				seats: [...o.seats],
				...(o.number !== undefined ? { number: o.number } : {}),
				...(o.yes !== undefined ? { yes: o.yes } : {}),
				...(o.none ? { none: true } : {})
			}));
		}
		const groups = new Map<string, ValidInfo>();
		for (const o of picker.options) {
			if (o.none) {
				groups.set('none', { ...reasonOf(o), none: true, number: 0, seats: [] });
				continue;
			}
			const [target, other] = o.seats;
			const ids = o.characterId ? [o.characterId] : (o.characterIds ?? []);
			const key = JSON.stringify([target, ids, o.registered ?? []]);
			const group =
				groups.get(key) ??
				groups.set(key, { ...reasonOf(o), characterIds: ids, target, seats: [] }).get(key)!;
			if (other && !group.seats.includes(other)) group.seats.push(other);
		}
		return [...groups.values()];
	}
}
