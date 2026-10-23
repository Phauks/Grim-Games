/**
 * Reminders of game state for a night step (Trevor, 2026-10-16: "when landing on a role
 * that can bounce a death or is poisoned, show reminders of this game state").
 *
 * For the waking character, `nightStepAlerts` lists:
 * - `impaired`: a waking player is drunk, poisoned or has no ability (from `abilityState`);
 * and, when the step can kill (`NIGHT_KILLERS`), for each player it might kill:
 * - `protected`: they cannot die tonight (the Storyteller's override, the Sailor, the
 *   Soldier or Monk against the Demon, the Tea Lady, the Innkeeper);
 * - `may-bounce`: an ability that may move the kill elsewhere (the Mayor, against the Demon);
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
import { getSeat, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import {
	abilityState,
	firstDeathSaver,
	killRedirect,
	protectors,
	type AbilitySource,
	type Impairment
} from './ability.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

/** Who a killing step's ability is: the Demon's kill, or another ability's. */
export type KillBy = 'demon' | 'other';

export interface NightKiller {
	by: KillBy;
	/** `self`: the ability can only kill its own player (the Gambler, the Acrobat). */
	targets: 'any' | 'self';
	/** The Assassin's kill ignores protection. */
	ignoresProtection?: true;
	wiki: string;
}

const demon = (name: string): NightKiller => ({ by: 'demon', targets: 'any', wiki: W + name });
const other = (name: string, targets: 'any' | 'self' = 'any'): NightKiller => ({
	by: 'other',
	targets,
	wiki: W + name
});

/**
 * Night steps that can kill. Every Demon kills at night except the Riot and the Leviathan,
 * whose deaths happen by day.
 */
export const NIGHT_KILLERS: Readonly<Record<CharacterId, NightKiller>> = {
	imp: demon('Imp'),
	po: demon('Po'),
	pukka: demon('Pukka'),
	shabaloth: demon('Shabaloth'),
	zombuul: demon('Zombuul'),
	nodashii: demon('No_Dashii'),
	vigormortis: demon('Vigormortis'),
	fanggu: demon('Fang_Gu'),
	vortox: demon('Vortox'),
	legion: demon('Legion'),
	lleech: demon('Lleech'),
	ojo: demon('Ojo'),
	kazali: demon('Kazali'),
	yaggababble: demon('Yaggababble'),
	alhadikhia: demon('Al-Hadikhia'),
	lordoftyphon: demon('Lord_of_Typhon'),
	lilmonsta: demon("Lil'_Monsta"),
	assassin: { by: 'other', targets: 'any', ignoresProtection: true, wiki: W + 'Assassin' },
	godfather: other('Godfather'),
	gossip: other('Gossip'),
	lycanthrope: other('Lycanthrope'),
	harlot: other('Harlot'),
	gambler: other('Gambler', 'self'),
	acrobat: other('Acrobat', 'self')
};

/**
 * Whether `characterId`'s ability is set off by its player's death, and by which deaths
 * (`onDeath` in its rules block: our `data/rules/<id>.json`, or a custom character's `rules`).
 */
export function onDeathTrigger(
	characterId: CharacterId,
	characters?: CharacterLookup
): { by: KillBy | 'any' } | undefined {
	return rulesOf(characterId, characters)?.onDeath;
}

/** The official characters whose ability is set off by their player's death. */
export const ON_DEATH: Readonly<Record<CharacterId, { by: KillBy | 'any' }>> = Object.fromEntries(
	[...OFFICIAL_RULES].flatMap(([id, rules]) => (rules.onDeath ? [[id, rules.onDeath]] : []))
);

export type NightAlertKind =
	'impaired' | 'protected' | 'may-bounce' | 'survives-first-death' | 'on-death';

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

	const killer = NIGHT_KILLERS[characterId];
	if (!killer) return out;
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
		const redirect = killRedirect(game, seatId, characters, killer.by);
		if (redirect) alert('may-bounce', redirect, wikiOf(redirect));
		const saver = firstDeathSaver(game, seatId, characters);
		if (saver) alert('survives-first-death', saver.source, wikiOf(saver.source));
	}

	const trigger = own ? onDeathTrigger(own, characters) : undefined;
	if (own && trigger && (trigger.by === 'any' || trigger.by === killer.by)) {
		const character = characters.get(own);
		alert('on-death', { characterId: own, seatId }, character && wikiUrl(character));
	}
	// The Grandmother dies if the Demon kills her grandchild.
	const grandchild = seat.reminders.find(
		(r) => r.characterId === 'grandmother' && r.label === 'Grandchild'
	);
	if (grandchild && killer.by === 'demon') {
		const from = holder('grandmother');
		alert(
			'on-death',
			{
				characterId: 'grandmother',
				...(from ? { seatId: from } : {}),
				reminderId: grandchild.reminderId
			},
			W + 'Grandmother'
		);
	}
	return out;
}
