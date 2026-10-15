/**
 * Night deaths a character's own ability causes, worked out from the grimoire so the
 * Storyteller is told who dies (the DEAD reminder) instead of having to remember:
 * - Gambler: a wrong guess kills the Gambler (https://wiki.bloodontheclocktower.com/Gambler);
 * - Acrobat: choosing a player who is drunk or poisoned tonight kills the Acrobat
 *   (https://wiki.bloodontheclocktower.com/Acrobat);
 * - Lycanthrope: a chosen good player dies and the Demon does not kill tonight
 *   (https://wiki.bloodontheclocktower.com/Lycanthrope);
 * - Grandmother: if the Demon killed the grandchild, the Grandmother dies too
 *   (https://wiki.bloodontheclocktower.com/Grandmother).
 *
 * A drunk or poisoned character has no ability (Glossary), so its ability kills nobody;
 * that counts for the Mathematician when it should have killed. Where the answer depends
 * on a Storyteller call (a Recluse or Spy registering, a death whose cause was not
 * recorded), the verdict is `ask`. Everything is a suggestion: the Storyteller marks
 * deaths themselves.
 *
 * Verdicts are data only (no wording): `because` says which rule decided it, and the
 * seats and sources say who, so the UI shows values.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { getSeat, trueCharacter } from '#lib/core/model/selectors.ts';
import type { AbnormalCause, Game, SeatId } from '#lib/core/model/types.ts';
import {
	abilityState,
	protection,
	registrations,
	registrationWorlds,
	type AbilitySource,
	type Impairment
} from './ability.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

/**
 * Which rule decided a verdict:
 * - `right-guess` / `wrong-guess`: the Gambler's guess;
 * - `chosen-impaired` / `chosen-healthy`: whether the Acrobat's choice is drunk or poisoned
 *   now (a later one tonight still kills the Acrobat);
 * - `registers-evil` / `registers-good` / `may-register`: the Lycanthrope's choice;
 * - `no-grandchild`, `grandchild-alive`, `not-demon-kill`, `demon-kill`, `cause-unknown`:
 *   the Grandmother's grandchild;
 * - `actor-dead`: the waking player is dead;
 * - `impaired`: the waking player is drunk, poisoned or has no ability (`impairments`);
 * - `protected`: the player who would die cannot die tonight (`protectedBy`).
 */
export type DeathBecause =
	| 'right-guess'
	| 'wrong-guess'
	| 'chosen-impaired'
	| 'chosen-healthy'
	| 'registers-evil'
	| 'registers-good'
	| 'may-register'
	| 'no-grandchild'
	| 'grandchild-alive'
	| 'not-demon-kill'
	| 'demon-kill'
	| 'cause-unknown'
	| 'actor-dead'
	| 'impaired'
	| 'protected';

interface VerdictDetail {
	because: DeathBecause;
	/** The waking player's impairments, for `impaired`. */
	impairments?: Impairment[];
	/** Who protects, for `protected` ('override': the Storyteller's "can die" override). */
	protectedBy?: AbilitySource | 'override';
	/** The chosen player's drunk or poisoned state, for the Acrobat. */
	chosen?: Impairment[];
	/** Players whose registration decides it, for `may-register`. */
	registering?: SeatId[];
}

/**
 * - `dies`: these players die (`demonKills: false`: and the Demon does not kill tonight);
 * - `no-death`: nobody dies from this ability; `abnormal` when it should have killed;
 * - `ask`: the Storyteller decides; if yes, `ifYes` die;
 * - `choose`: the choice is missing (`missing`) or not allowed.
 */
export type DeathVerdict =
	| ({ kind: 'dies'; seatIds: SeatId[]; demonKills?: false } & VerdictDetail)
	| ({ kind: 'no-death'; abnormal?: AbnormalCause[] } & VerdictDetail)
	| ({ kind: 'ask'; ifYes: SeatId[]; demonKills?: false } & VerdictDetail)
	| { kind: 'choose'; missing: 'player' | 'character' | 'alive-player' };

type NoDeath = Extract<DeathVerdict, { kind: 'no-death' }>;

/** What the waking player chose: a player, and for the Gambler a character. */
export interface DeathChoice {
	seatId?: SeatId;
	characterId?: CharacterId;
}

export type DeathNeeds = 'player' | 'player-character' | 'none';

export const DEATH_CHECKS: Readonly<Record<CharacterId, { needs: DeathNeeds; wiki: string }>> = {
	gambler: { needs: 'player-character', wiki: `${W}Gambler` },
	acrobat: { needs: 'player', wiki: `${W}Acrobat` },
	lycanthrope: { needs: 'player', wiki: `${W}Lycanthrope` },
	grandmother: { needs: 'none', wiki: `${W}Grandmother` }
};

/** The death check for one waking player; `verdict` is worked out when no choice is needed. */
export interface DeathCheck {
	characterId: CharacterId;
	/** The waking player. */
	seatId: SeatId;
	needs: DeathNeeds;
	verdict?: DeathVerdict;
	wiki: string;
}

export function causesOf(impairments: readonly Impairment[]): AbnormalCause[] {
	return impairments.map((i) => ({
		reason: i.reason,
		characterId: i.source.characterId,
		...(i.source.seatId ? { seatId: i.source.seatId } : {})
	}));
}

function protectedCause(source: AbilitySource | 'override'): AbnormalCause {
	return source === 'override'
		? { reason: 'protected' }
		: {
				reason: 'protected',
				characterId: source.characterId,
				...(source.seatId ? { seatId: source.seatId } : {})
			};
}

const impaired = (impairments: Impairment[], abnormal: boolean): NoDeath => ({
	kind: 'no-death',
	because: 'impaired',
	impairments,
	...(abnormal ? { abnormal: causesOf(impairments) } : {})
});

const guarded = (by: AbilitySource | 'override'): NoDeath => ({
	kind: 'no-death',
	because: 'protected',
	protectedBy: by,
	abnormal: [protectedCause(by)]
});

function gambler(
	game: Game,
	seatId: SeatId,
	choice: DeathChoice,
	characters: CharacterLookup
): DeathVerdict {
	const target = choice.seatId;
	const guess = choice.characterId;
	if (!target || !getSeat(game, target)) return { kind: 'choose', missing: 'player' };
	if (!guess) return { kind: 'choose', missing: 'character' };
	if (trueCharacter(game, target, characters) === guess) {
		return { kind: 'no-death', because: 'right-guess' };
	}
	const self = abilityState(game, seatId, characters);
	if (self.impairments.length > 0) return impaired(self.impairments, true);
	// A Recluse or Spy might register as the guessed character's type: the Storyteller's call.
	const guessType = characters.get(guess)?.type;
	const reg = registrations(game, characters).find((r) => r.seatId === target);
	if (reg && guessType && reg.types.slice(1).includes(guessType)) {
		return { kind: 'ask', ifYes: [seatId], because: 'may-register', registering: [target] };
	}
	const safe = protection(game, seatId, characters, 'other');
	if (safe) return guarded(safe);
	return { kind: 'dies', seatIds: [seatId], because: 'wrong-guess' };
}

function acrobat(
	game: Game,
	seatId: SeatId,
	choice: DeathChoice,
	characters: CharacterLookup
): DeathVerdict {
	const target = choice.seatId;
	if (!target || !getSeat(game, target)) return { kind: 'choose', missing: 'player' };
	const chosen = abilityState(game, target, characters).impairments.filter(
		(i) => i.reason === 'drunk' || i.reason === 'poisoned'
	);
	// Not drunk or poisoned now; if they become so later tonight, the Acrobat dies then.
	if (chosen.length === 0) return { kind: 'no-death', because: 'chosen-healthy' };
	const self = abilityState(game, seatId, characters);
	if (self.impairments.length > 0) return { ...impaired(self.impairments, true), chosen };
	const safe = protection(game, seatId, characters, 'other');
	if (safe) return { ...guarded(safe), chosen };
	return { kind: 'dies', seatIds: [seatId], because: 'chosen-impaired', chosen };
}

function lycanthrope(
	game: Game,
	seatId: SeatId,
	choice: DeathChoice,
	characters: CharacterLookup
): DeathVerdict {
	const target = choice.seatId;
	const seat = target ? getSeat(game, target) : undefined;
	if (!target || !seat) return { kind: 'choose', missing: 'player' };
	if (seat.dead) return { kind: 'choose', missing: 'alive-player' };
	const alignments = new Set(registrationWorlds(game, characters).map((w) => w.alignment(target)));
	if (!alignments.has('good')) return { kind: 'no-death', because: 'registers-evil' };
	const self = abilityState(game, seatId, characters);
	if (self.impairments.length > 0) return impaired(self.impairments, !alignments.has('evil'));
	// A good player who cannot die: the Demon may still kill tonight.
	const safe = protection(game, target, characters, 'other');
	if (safe) return guarded(safe);
	if (alignments.has('evil')) {
		return {
			kind: 'ask',
			ifYes: [target],
			demonKills: false,
			because: 'may-register',
			registering: [target]
		};
	}
	return { kind: 'dies', seatIds: [target], demonKills: false, because: 'registers-good' };
}

function grandmother(game: Game, seatId: SeatId, characters: CharacterLookup): DeathVerdict {
	if (game.seats[seatId]?.dead) return { kind: 'no-death', because: 'actor-dead' };
	const grandchild = game.seating.find((s) =>
		game.seats[s].reminders.some((r) => r.characterId === 'grandmother' && r.label === 'Grandchild')
	);
	if (!grandchild) return { kind: 'no-death', because: 'no-grandchild' };
	const child = game.seats[grandchild];
	if (!child.dead) return { kind: 'no-death', because: 'grandchild-alive' };
	const cause = child.deathCause;
	const self = abilityState(game, seatId, characters);
	if (cause === undefined) {
		return {
			kind: 'ask',
			ifYes: self.impairments.length > 0 ? [] : [seatId],
			because: 'cause-unknown',
			...(self.impairments.length > 0 ? { impairments: self.impairments } : {})
		};
	}
	const byDemon = cause === 'demon' || characters.get(cause)?.type === 'demon';
	if (!byDemon) return { kind: 'no-death', because: 'not-demon-kill' };
	if (self.impairments.length > 0) return impaired(self.impairments, true);
	const safe = protection(game, seatId, characters, 'other');
	if (safe) return guarded(safe);
	return { kind: 'dies', seatIds: [seatId], because: 'demon-kill' };
}

/**
 * Who dies from `characterId`'s ability, used by the player in `seatId` (a Pixie with the
 * Gambler's ability is checked as the Gambler). Undefined for characters not covered.
 */
export function deathVerdict(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	choice: DeathChoice,
	characters: CharacterLookup
): DeathVerdict | undefined {
	switch (characterId) {
		case 'gambler':
			return gambler(game, seatId, choice, characters);
		case 'acrobat':
			return acrobat(game, seatId, choice, characters);
		case 'lycanthrope':
			return lycanthrope(game, seatId, choice, characters);
		case 'grandmother':
			return grandmother(game, seatId, characters);
		default:
			return undefined;
	}
}

/** The death check for a waking player, or undefined for a character it does not cover. */
export function deathCheck(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): DeathCheck | undefined {
	const spec = Object.hasOwn(DEATH_CHECKS, characterId) ? DEATH_CHECKS[characterId] : undefined;
	if (!spec) return undefined;
	return {
		characterId,
		seatId,
		needs: spec.needs,
		...(spec.needs === 'none'
			? { verdict: deathVerdict(game, seatId, characterId, {}, characters) }
			: {}),
		wiki: spec.wiki
	};
}
