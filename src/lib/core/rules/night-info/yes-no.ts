/**
 * Night information: the answers a "yes or no" character could be given for the two players
 * it chose (Fortune Teller, Seamstress), as rows the Storyteller reads once the choice is
 * entered. Part of `night-info.ts`.
 */
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { type InfoPicker, type ValidReason, validInformation } from './picker.ts';

/** One answer the waking player could be given, and why it is valid. */
export interface YesNoAnswer {
	yes: boolean;
	reason: ValidReason;
	/** For `registers`: the players who would register as something else. */
	registered?: SeatId[];
}

const sameSeats = (a: readonly SeatId[], b: readonly SeatId[]) =>
	a.length === b.length && a.every((s) => b.includes(s));

/** The players a `yes-no` picker's player may choose (the Fortune Teller may choose themselves). */
export function yesNoSeats(game: Game, picker: InfoPicker): SeatId[] {
	if (picker.kind !== 'yes-no') return [];
	const chosen = new Set(picker.options.flatMap((o) => o.seats));
	return game.seating.filter((s) => chosen.has(s));
}

/**
 * The valid answers for the players chosen: true first, then those that need someone to
 * register otherwise, then the other answer when the player's ability does not work (or must
 * be false, under the Vortox). Empty for other pickers, or until every player is chosen.
 */
export function yesNoAnswers(
	game: Game,
	picker: InfoPicker,
	seats: readonly SeatId[]
): YesNoAnswer[] {
	if (picker.kind !== 'yes-no' || seats.length !== picker.seatCount) return [];
	const valid = validInformation(game, picker);
	const out: YesNoAnswer[] = [];
	for (const v of valid) {
		if (v.yes === undefined || !sameSeats(v.seats, seats)) continue;
		if (out.some((o) => o.yes === v.yes)) continue;
		out.push({
			yes: v.yes,
			reason: v.reason,
			...(v.registered ? { registered: v.registered } : {})
		});
	}
	const loose = valid.find((v) => v.anyOther)?.reason;
	if (loose) {
		const truth = picker.options.find((o) => !o.registered && sameSeats(o.seats, seats))?.yes;
		for (const yes of [true, false]) {
			if (out.some((o) => o.yes === yes)) continue;
			// Under the Vortox only the false answer may be given.
			if (loose === 'vortox' && yes === truth) continue;
			out.push({ yes, reason: loose });
		}
	}
	return out;
}
