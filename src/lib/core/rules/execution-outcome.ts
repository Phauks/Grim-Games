/**
 * Executions that fail, or that an ability forces (`executionOutcome` in a character's rules,
 * `data/parts/execution-outcome.ts`). The Execution dialog offers each one while the ability
 * works; the Storyteller decides, so nothing here happens on its own:
 * - `failsIf: only-evil-voted`: no good player voted for the nominee, so the execution fails
 *   (the Legion, https://wiki.bloodontheclocktower.com/Legion);
 * - `force: pass-or-fail`: once per game, on another player's nomination, its player makes
 *   the execution pass or fail (the Judge, https://wiki.bloodontheclocktower.com/Judge);
 * - `executeNow: good-voted`: its player may execute a nominee straight away once a good
 *   player voted for them (the Vizier, https://wiki.bloodontheclocktower.com/Vizier).
 *
 * Votes aren't recorded yet, so the Storyteller answers whether only evil (or any good)
 * voted. `votersAnswer` is the hook for a recorded vote: given the voters, it works the
 * answer out, and gives undefined while there is no record.
 */
import type { ExecutionOutcomeRule } from '#lib/core/data/parts/execution-outcome.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import { todaysNominations } from './nominations.ts';

/** TPI's reminder for a spent once-per-game ability (game data). */
const NO_ABILITY = 'No Ability';

/**
 * What an ability may do to an execution: `fails` (the Legion's), `force` (the Judge's pass
 * or fail) or `execute-now` (the Vizier's).
 */
export type OutcomeKind = 'fails' | 'force' | 'execute-now';

/**
 * Why an outcome may not apply to this nominee (the Storyteller may still record it):
 * - `not-working`: no player of the character has a working ability;
 * - `not-nominated`: nobody nominated the player today;
 * - `own-nomination`: only the ability's own player nominated them (the Judge);
 * - `used`: the once-per-game ability is already spent ("No Ability", or `dayUse.spentToken`).
 */
export type OutcomeProblem = 'not-working' | 'not-nominated' | 'own-nomination' | 'used';

/** A character in play whose ability can change an execution's outcome. */
export interface OutcomeHolder {
	kind: OutcomeKind;
	characterId: CharacterId;
	/** The player whose ability it is: the first whose ability works, else the first. */
	seatId: SeatId;
	works: boolean;
}

/** An outcome offered for one nominee, with why it may not apply. */
export interface OutcomeOffer extends OutcomeHolder {
	problem?: OutcomeProblem;
}

/** What the Execute command records: the execution failed, or was forced, by `characterId`. */
export interface ExecutionOutcome {
	kind: 'failed' | 'forced';
	characterId: CharacterId;
}

const KINDS = (rule: ExecutionOutcomeRule): OutcomeKind[] => [
	...(rule.failsIf ? (['fails'] as const) : []),
	...(rule.force ? (['force'] as const) : []),
	...(rule.executeNow ? (['execute-now'] as const) : [])
];

/**
 * Every character in a seat whose ability can change an execution's outcome, one per
 * character and kind (several Legion players are one), in seating order.
 */
export function outcomeHolders(game: Game, characters: CharacterLookup): OutcomeHolder[] {
	const out: OutcomeHolder[] = [];
	for (const seatId of game.seating) {
		const characterId = trueCharacter(game, seatId, characters);
		const rule = characterId ? rulesOf(characterId, characters)?.executionOutcome : undefined;
		if (!characterId || !rule) continue;
		const works = abilityState(game, seatId, characters).works;
		for (const kind of KINDS(rule)) {
			const at = out.findIndex((h) => h.characterId === characterId && h.kind === kind);
			if (at < 0) out.push({ kind, characterId, seatId, works });
			else if (works && !out[at].works) out[at] = { kind, characterId, seatId, works };
		}
	}
	return out;
}

/** Whether a once-per-game ability's spent token is on its player. */
function spent(game: Game, holder: OutcomeHolder, characters: CharacterLookup): boolean {
	const label = rulesOf(holder.characterId, characters)?.dayUse?.spentToken ?? NO_ABILITY;
	return game.seats[holder.seatId].reminders.some(
		(r) => r.characterId === holder.characterId && r.label === label
	);
}

/** Why `holder`'s outcome may not apply to an execution of `nominee`, if anything. */
function problemOf(
	game: Game,
	holder: OutcomeHolder,
	nominee: SeatId,
	characters: CharacterLookup
): OutcomeProblem | undefined {
	if (!holder.works) return 'not-working';
	if (holder.kind === 'fails') return undefined;
	const nominations = todaysNominations(game).filter((n) => n.nominee === nominee);
	if (nominations.length === 0) return 'not-nominated';
	if (holder.kind === 'execute-now') return undefined;
	if (nominations.every((n) => n.nominator === holder.seatId)) return 'own-nomination';
	return spent(game, holder, characters) ? 'used' : undefined;
}

/**
 * The outcomes the Execution dialog offers for executing `nominee`: one per character in play
 * whose ability works, each with why it may not apply to this nominee.
 */
export function executionOutcomes(
	game: Game,
	nominee: SeatId,
	characters: CharacterLookup
): OutcomeOffer[] {
	return outcomeHolders(game, characters)
		.filter((h) => h.works)
		.map((h) => {
			const problem = problemOf(game, h, nominee, characters);
			return problem ? { ...h, problem } : h;
		});
}

/**
 * The holder whose ability gives `outcome`: a failed execution comes from `fails` or `force`,
 * a forced one from `force` or `execute-now`. Undefined when no such character is in a seat.
 */
export function outcomeHolder(
	game: Game,
	outcome: ExecutionOutcome,
	characters: CharacterLookup
): OutcomeHolder | undefined {
	const kinds: OutcomeKind[] =
		outcome.kind === 'failed' ? ['fails', 'force'] : ['force', 'execute-now'];
	return outcomeHolders(game, characters).find(
		(h) => h.characterId === outcome.characterId && kinds.includes(h.kind)
	);
}

/**
 * Why recording `outcome` for executing `nominee` may be wrong, for the engine's warning:
 * `no-rule` when no character in a seat has that outcome, else the holder's problem.
 */
export function outcomeProblem(
	game: Game,
	nominee: SeatId,
	outcome: ExecutionOutcome,
	characters: CharacterLookup
): OutcomeProblem | 'no-rule' | undefined {
	const holder = outcomeHolder(game, outcome, characters);
	return holder ? problemOf(game, holder, nominee, characters) : 'no-rule';
}

/**
 * The hook for a recorded vote (M9a): given who voted, whether only evil players did
 * (`only-evil-voted`, the Legion) or a good player did (`good-voted`, the Vizier). Undefined
 * while there is no record, so the Storyteller is asked. Alignments are the grimoire's: a
 * player who might register otherwise is still the Storyteller's call.
 */
export function votersAnswer(
	game: Game,
	question: 'only-evil-voted' | 'good-voted',
	voters: readonly SeatId[] | undefined
): boolean | undefined {
	if (voters === undefined) return undefined;
	const good = voters.some((s) => alignmentOf(game, s) === 'good');
	return question === 'good-voted' ? good : voters.length > 0 && !good;
}
