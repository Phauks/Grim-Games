/**
 * Reminders of game state for a night step (Trevor, 2026-10-16: "when landing on a role
 * that can bounce a death or is poisoned, show reminders of this game state").
 *
 * For the waking character, `nightStepAlerts` lists:
 * - `impaired`: a waking player is drunk, poisoned or has no ability (from `abilityState`);
 * - `blocked`: another ability's token stops them waking tonight (`stopsWaking`: the
 *   Exorcist's Chosen on the Demon, https://wiki.bloodontheclocktower.com/Exorcist);
 * - `no-kill`: another ability's token stops them killing tonight, so no kill alerts follow
 *   (`stopsKilling`: the Princess's Doesn't Kill on the Demon,
 *   https://wiki.bloodontheclocktower.com/Princess);
 * - `seating`: a character whose neighbours are turned evil at setup (`turnsPlayersInto`
 *   `neighbours`) is not inside one line of every evil player
 *   (https://wiki.bloodontheclocktower.com/Lord_of_Typhon);
 * and, when the step can kill (`NIGHT_KILLERS`), for each player it might kill:
 * - `protected`: they cannot die tonight (the Storyteller's override, the Sailor, the
 *   Soldier or Monk against the Demon, the Tea Lady, the Innkeeper);
 * - `may-bounce`: an ability that may move the kill elsewhere (the Mayor, against the Demon),
 *   unless a working protection already keeps them safe;
 * - `survives-first-death`: an ability that stops its player's first death (the Fool), until
 *   its spent token is placed;
 * - `on-death`: dying sets off an ability (the Ravenkeeper wakes, the Farmer passes on,
 *   the Grandmother dies with her grandchild...).
 *
 * Every alert names its subject seat and its source, and says whether the source's
 * ability works now (`works`, with `impairments` when it does not): a poisoned Monk's
 * Safe token protects nobody, which is itself worth a reminder. Data only, no wording.
 *
 * Basis: each character's ability text in TPI's data and its wiki page (cited per entry);
 * the reminders come from the tokens on the board, so the Storyteller stays in charge.
 * Day-only effects (the Pacifist, the Devil's Advocate) are not night alerts.
 */
import { OFFICIAL_RULES, rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, getSeat, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { DeathCause, Game, SeatId } from '#lib/core/model/types.ts';
import { isExecution } from './death-causes.ts';
import {
	abilityState,
	firstDeathSaver,
	killRedirect,
	protection,
	protectors,
	type AbilitySource,
	type Impairment
} from './ability.ts';

/** Who a killing step's ability is: the Demon's kill, or another ability's. */
export type KillBy = 'demon' | 'other';

export interface NightKiller {
	by: KillBy;
	/** `self`: the ability can only kill its own player (the Gambler, the Acrobat). */
	targets: 'any' | 'self';
	/** The Assassin's kill ignores protection. */
	ignoresProtection: boolean;
}

/**
 * Whether `characterId`'s night step can kill, and how (`kills` in its rules block: our
 * `data/rules/<id>.json`, or a custom character's `rules`). Every Demon kills at night except
 * the Riot and the Leviathan, whose deaths happen by day.
 */
export function nightKiller(
	characterId: CharacterId,
	characters?: CharacterLookup
): NightKiller | undefined {
	const kills = rulesOf(characterId, characters)?.kills;
	return (
		kills && {
			by: kills.by,
			targets: kills.targets ?? 'any',
			ignoresProtection: kills.ignoresProtection ?? false
		}
	);
}

/** The official characters whose night step can kill. */
export const NIGHT_KILLERS: Readonly<Record<CharacterId, NightKiller>> = Object.fromEntries(
	[...OFFICIAL_RULES.keys()].flatMap((id) => {
		const killer = nightKiller(id);
		return killer ? [[id, killer]] : [];
	})
);

/**
 * Whether `characterId`'s ability is set off by its player's death, and by which deaths
 * (`onDeath` in its rules block: our `data/rules/<id>.json`, or a custom character's `rules`).
 */
export function onDeathTrigger(
	characterId: CharacterId,
	characters?: CharacterLookup
): { by: KillBy | 'any'; night?: true } | undefined {
	return rulesOf(characterId, characters)?.onDeath;
}

/**
 * Whether a death of this `cause` sets off the trigger: `by` the Demon only for a Demon's kill
 * (the Sage, https://wiki.bloodontheclocktower.com/Sage; the Banshee,
 * https://wiki.bloodontheclocktower.com/Banshee), and with `night` never an execution or exile
 * (the Ravenkeeper, https://wiki.bloodontheclocktower.com/Ravenkeeper: "getting killed during
 * the day reveals nothing"; the Farmer). A death whose cause was not recorded counts, so the
 * Storyteller is still shown the step (warn, never lock).
 */
export function onDeathApplies(
	trigger: { by: KillBy | 'any'; night?: true },
	cause: DeathCause | undefined,
	characters: CharacterLookup
): boolean {
	if (cause === undefined) return true;
	const executed = cause === 'exile' || isExecution(cause, characters);
	if (trigger.night && executed) return false;
	if (trigger.by === 'any') return true;
	const byDemon = cause === 'demon' || characters.get(cause)?.type === 'demon';
	return trigger.by === 'demon' ? byDemon : !byDemon && !executed;
}

/** The official characters whose ability is set off by their player's death. */
export const ON_DEATH: Readonly<Record<CharacterId, { by: KillBy | 'any'; night?: true }>> =
	Object.fromEntries(
		[...OFFICIAL_RULES].flatMap(([id, rules]) => (rules.onDeath ? [[id, rules.onDeath]] : []))
	);

export type NightAlertKind =
	| 'impaired'
	| 'blocked'
	| 'no-kill'
	| 'seating'
	| 'protected'
	| 'may-bounce'
	| 'survives-first-death'
	| 'on-death';

export interface NightAlert {
	kind: NightAlertKind;
	/** The player the alert is about: the waking player, or one who might die. */
	seatId: SeatId;
	/** Whose ability it is; 'override' for the Storyteller's "can die" override. */
	source: AbilitySource | 'override';
	/** Whether the source's ability works now; when not, it does nothing tonight. */
	works: boolean;
	/** Why the source's ability does not work (empty when it works). */
	impairments: Impairment[];
	wiki?: string;
}

/**
 * Whether every evil player sits in one unbroken line round the table with `seatId` inside
 * it, an evil player on each side (the Lord of Typhon's setup). Warns only.
 */
export function evilInOneLine(game: Game, seatId: SeatId): boolean {
	const seating = game.seating;
	const n = seating.length;
	const at = seating.indexOf(seatId);
	if (at < 0 || n < 3) return true;
	const evil = (i: number) => alignmentOf(game, seating[((i % n) + n) % n]) === 'evil';
	if (!evil(at - 1) || !evil(at + 1)) return false;
	let left = 0;
	while (left < n - 1 && evil(at - left - 1)) left += 1;
	let right = 0;
	while (left + right < n - 1 && evil(at + right + 1)) right += 1;
	return seating.filter((_, i) => evil(i)).length === Math.min(n, 1 + left + right);
}

/** Seats whose true character, or token, is `characterId`. */
function actorSeats(game: Game, characterId: CharacterId, characters: CharacterLookup): SeatId[] {
	return game.seating.filter(
		(s) =>
			trueCharacter(game, s, characters) === characterId ||
			game.seats[s]?.characterId === characterId
	);
}

/**
 * The game-state reminders for the step of `characterId` (see the module comment), in
 * this order: impaired waking players, then per player in seating order.
 */
export function nightStepAlerts(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): NightAlert[] {
	const actors = actorSeats(game, characterId, characters);
	const out: NightAlert[] = [];
	for (const seatId of actors) {
		const state = abilityState(game, seatId, characters);
		if (state.impairments.length === 0) continue;
		out.push({
			kind: 'impaired',
			seatId,
			source: { characterId, seatId },
			works: false,
			impairments: state.impairments
		});
	}
	if (rulesOf(characterId, characters)?.turnsPlayersInto?.players === 'neighbours')
		for (const seatId of actors)
			if (!evilInOneLine(game, seatId))
				out.push({
					kind: 'seating',
					seatId,
					source: { characterId, seatId },
					works: true,
					impairments: []
				});
	let noKill = false;
	for (const seatId of actors) {
		for (const r of game.seats[seatId].reminders) {
			const rules = rulesOf(r.characterId, characters);
			const waking = rules?.stopsWaking?.token === r.label;
			const stops = waking ? rules?.stopsWaking : rules?.stopsKilling;
			if (stops?.token !== r.label) continue;
			if (stops.type && typeOf(game, seatId, characters) !== stops.type) continue;
			if (!waking) noKill = true;
			const source = game.seating.find(
				(s) => s !== seatId && trueCharacter(game, s, characters) === r.characterId
			);
			const character = characters.get(r.characterId);
			out.push(
				sourceAlert(
					game,
					waking ? 'blocked' : 'no-kill',
					seatId,
					{
						characterId: r.characterId,
						...(source ? { seatId: source } : {}),
						reminderId: r.reminderId
					},
					characters,
					character && wikiUrl(character)
				)
			);
		}
	}

	const killer = nightKiller(characterId, characters);
	if (!killer || noKill) return out;
	const subjects = (killer.targets === 'self' ? actors : game.seating).filter(
		(s) => getSeat(game, s)?.dead === false
	);
	for (const seatId of subjects) out.push(...deathAlerts(game, seatId, killer, characters));
	return out;
}

function sourceAlert(
	game: Game,
	kind: NightAlertKind,
	seatId: SeatId,
	source: AbilitySource,
	characters: CharacterLookup,
	wiki: string | undefined
): NightAlert {
	const impairments = source.seatId
		? abilityState(game, source.seatId, characters).impairments
		: [];
	const alert: NightAlert = { kind, seatId, source, works: impairments.length === 0, impairments };
	if (wiki) alert.wiki = wiki;
	return alert;
}

function deathAlerts(
	game: Game,
	seatId: SeatId,
	killer: NightKiller,
	characters: CharacterLookup
): NightAlert[] {
	const seat = game.seats[seatId];
	const own = trueCharacter(game, seatId, characters);
	const out: NightAlert[] = [];
	const alert = (kind: NightAlertKind, source: AbilitySource, wiki: string | undefined) =>
		out.push(sourceAlert(game, kind, seatId, source, characters, wiki));
	const wikiOf = (source: AbilitySource) => {
		const character = characters.get(source.characterId);
		return character && wikiUrl(character);
	};
	const holder = (id: CharacterId) =>
		game.seating.find((s) => trueCharacter(game, s, characters) === id);

	if (!killer.ignoresProtection) {
		const override = seat.overrides.find((o) => o.field === 'canDie');
		if (override && !override.value) {
			out.push({ kind: 'protected', seatId, source: 'override', works: true, impairments: [] });
		}
		for (const { source } of protectors(game, seatId, characters, killer.by)) {
			alert('protected', source, wikiOf(source));
		}
		// A player a working protection keeps safe has no kill to move elsewhere (the Monk's
		// Mayor example: https://wiki.bloodontheclocktower.com/Monk).
		const redirect = protection(game, seatId, characters, killer.by)
			? undefined
			: killRedirect(game, seatId, characters, killer.by);
		if (redirect) alert('may-bounce', redirect, wikiOf(redirect));
		const saver = firstDeathSaver(game, seatId, characters);
		if (saver) alert('survives-first-death', saver.source, wikiOf(saver.source));
	}

	const trigger = own ? onDeathTrigger(own, characters) : undefined;
	if (own && trigger && (trigger.by === 'any' || trigger.by === killer.by)) {
		const character = characters.get(own);
		alert('on-death', { characterId: own, seatId }, character && wikiUrl(character));
	}
	// A player dies with the one their token marks when the Demon kills them (`deathCheck`
	// `marked-killed-by-demon`: the Grandmother's Grandchild,
	// https://wiki.bloodontheclocktower.com/Grandmother).
	if (killer.by === 'demon') {
		for (const r of seat.reminders) {
			const check = rulesOf(r.characterId, characters)?.deathCheck;
			if (check?.kind !== 'marked-killed-by-demon' || check.token !== r.label) continue;
			const from = holder(r.characterId);
			const character = characters.get(r.characterId);
			alert(
				'on-death',
				{
					characterId: r.characterId,
					...(from ? { seatId: from } : {}),
					reminderId: r.reminderId
				},
				character && wikiUrl(character)
			);
		}
	}
	return out;
}
