/**
 * Values for the night steps, shown without new explanatory wording (Trevor, 2026-10-15:
 * values, names and TPI token text only): who is impaired and by whom, registration
 * ranges, Mathematician causes and death verdicts.
 */
import type { AbnormalCause, SeatId } from '#lib/core/model/index.ts';
import type {
	AbilitySource,
	AnswerValue,
	DeathVerdict,
	Impairment,
	NightAnswer
} from '#lib/core/rules/index.ts';
import type { DayGame } from './day-game.svelte.ts';

/** "Ben (Poisoner)", or "Poisoner" with no seat. */
function sourceName(game: DayGame, source: AbilitySource | 'override'): string {
	if (source === 'override') return '';
	const character = game.characterName(source.characterId);
	return source.seatId ? `${game.seatName(source.seatId)} (${character})` : character;
}

/** "poisoned · Ben (Poisoner)"; the Drunk: "drunk · Drunk"; the Preacher's: "No Ability · …". */
export function impairmentValues(game: DayGame, impairments: readonly Impairment[]): string {
	return impairments
		.map((i) => {
			// "No Ability" is the Preacher's reminder token (TPI).
			const state = i.reason === 'no-ability' ? 'No Ability' : i.reason;
			return `${state} · ${sourceName(game, i.source)}`;
		})
		.join('; ');
}

function valueText(game: DayGame, v: AnswerValue): string {
	switch (v.kind) {
		case 'yes-no':
			return v.value ? 'Yes' : 'No';
		case 'character':
			return game.characterName(v.value);
		case 'number':
			return String(v.value);
		case 'none':
			return v.reason;
	}
}

/** "0 / 1": every answer registration allows, the true one first. */
export function possibleText(game: DayGame, possible: readonly AnswerValue[] | undefined): string {
	return possible ? possible.map((v) => valueText(game, v)).join(' / ') : '';
}

function causeText(game: DayGame, c: AbnormalCause): string {
	const who =
		c.characterId !== undefined
			? sourceName(game, {
					characterId: c.characterId,
					...(c.seatId ? { seatId: c.seatId } : {})
				})
			: '';
	if (c.reason === 'registration' || c.reason === 'vortox' || c.reason === 'protected') {
		return who;
	}
	if (c.reason === 'no-ability') return `No Ability · ${who}`;
	return who ? `${c.reason} · ${who}` : c.reason;
}

/** Mathematician: "Chef (Ana): Recluse (Cat); Empath (Eve): poisoned · Ben (Poisoner)". */
export function abnormalText(game: DayGame, a: NightAnswer): string {
	return (a.abnormal ?? [])
		.map(
			(u) =>
				`${game.characterName(u.characterId)} (${game.seatName(u.seatId)}): ${u.causes
					.map((c) => causeText(game, c))
					.join(', ')}`
		)
		.join('; ');
}

const names = (game: DayGame, seats: readonly SeatId[]) =>
	seats.map((s) => game.seatName(s)).join(', ');

/**
 * A death verdict as values: "Dead: Ana" (the DEAD reminder), "Dead? Ana" when it is the
 * Storyteller's call, "—" when nobody dies, then who is impaired, protects or may register.
 */
export function verdictText(game: DayGame, v: DeathVerdict | undefined): string {
	if (!v || v.kind === 'choose') return '';
	const parts: string[] = [];
	if (v.kind === 'dies') parts.push(`Dead: ${names(game, v.seatIds)}`);
	else if (v.kind === 'ask') parts.push(`Dead? ${names(game, v.ifYes)}`);
	else parts.push('—');
	if (v.kind !== 'no-death' && v.demonKills === false) parts.push('Demon ✕');
	if (v.chosen?.length) parts.push(impairmentValues(game, v.chosen));
	if (v.impairments?.length) parts.push(impairmentValues(game, v.impairments));
	if (v.protectedBy) parts.push(sourceName(game, v.protectedBy));
	if (v.registering?.length) parts.push(`Might register falsely: ${names(game, v.registering)}`);
	return parts.filter(Boolean).join(' · ');
}
