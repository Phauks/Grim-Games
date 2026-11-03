/**
 * Reminders of game state for a night step (Trevor, 2026-10-16: "when landing on a role
 * that can bounce a death or is poisoned, show reminders of this game state").
 *
 * For the waking character, `nightStepAlerts` lists:
 * - `impaired`: a waking player is drunk, poisoned or has no ability (from `abilityState`);
 * - `blocked`: another ability's token stops them waking tonight (`stopsWaking`: the
 *   Exorcist's Chosen on the Demon, https://wiki.bloodontheclocktower.com/Exorcist);
 * - `acts-twice`: another ability's token makes their ability work twice tonight, so they wake
 *   again after this step (`actsTwice`: the Barista's Acts Twice,
 *   https://wiki.bloodontheclocktower.com/Barista);
 * - `no-kill`: another ability's token stops them killing tonight, so no kill alerts follow
 *   (`stopsKilling`: the Princess's Doesn't Kill on the Demon,
 *   https://wiki.bloodontheclocktower.com/Princess), a jinx does (`noKill` in the `jinxes`
 *   block: the Exorcist's Chosen on the Yaggababble, the Cannibal who nominated and executed
 *   the Princess today, https://wiki.bloodontheclocktower.com/Princess#Related_Jinxes),
 *   or a `no-kill` effect the Storyteller picked for this night (`pickedEffect`: the Angel's
 *   Something Bad);
 * - `no-grimoire`: a jinx says the waking player does not see the Grimoire while another
 *   character's ability works (`noGrimoire`: the Spy and the Widow while the Poppy Grower has
 *   its ability, https://wiki.bloodontheclocktower.com/Poppy_Grower#Related_Jinxes);
 * - `grimoire-hides`: a jinx says this player's token comes off the Grimoire while the waking
 *   player sees it (`grimoireHides`: the Demon's and the Magician's, for the Spy and the
 *   Widow, https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes);
 * - `jinx-chosen`: a jinx's night choice picked a partner tonight, who uses its ability
 *   without dying or dies and gains it (`outcome`), shown at the partner's step and the
 *   chooser's (`nightChoice`: the Leviathan's and Riot's Sage, Farmer, Ravenkeeper and
 *   Banshee, https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes);
 * - `learns-gained`: a jinx has the waking player learn something the night after gaining
 *   another character's ability (`learnsGained`, `learns`: the Cannibal learns it has the
 *   Butler or Zealot ability, or the executed Juggler's number,
 *   https://wiki.bloodontheclocktower.com/Cannibal#Related_Jinxes);
 * - `true-info`: a jinx says a character's false information doesn't apply to the waking
 *   player's, so it is given truly (`trueInfo`: the Vortox's Banshee is announced,
 *   https://wiki.bloodontheclocktower.com/Vortox#Related_Jinxes);
 * - `may-skip-attack` / `must-skip-attack` / `final-night`: a rule in play lets the Demon
 *   choose not to attack, it still has to once (its reminder is on the Demon), or it is still
 *   marked on a night its attack could end the game, so it doesn't wake and no kill alerts
 *   follow (`demonAttack`, `demon-attack.ts`: the Toymaker,
 *   https://wiki.bloodontheclocktower.com/Toymaker);
 * - `seating`: a character whose neighbours are turned evil at setup (`turnsPlayersInto`
 *   `neighbours`) is not inside one line of every evil player
 *   (https://wiki.bloodontheclocktower.com/Lord_of_Typhon);
 * - `wakes-with` / `keeps-protection`: a jinxed partner's player wakes at this step too and
 *   learns the choice, or learns this step took their ability while their protection holds
 *   (`jinx-partner-alerts.ts`: the Vizier with the Fearmonger, the Courtier and the Preacher,
 *   https://wiki.bloodontheclocktower.com/Vizier#Related_Jinxes);
 * - `learns-no-ability` / `might-learn`: a jinx has the waking player learn on the first night
 *   that the partner took their ability, or lets a player whose ability spared the partner
 *   learn the partner is in play (`jinx-partner-alerts.ts`: the Engineer, the Minstrel and the
 *   Preacher with Legion, https://wiki.bloodontheclocktower.com/Legion#Related_Jinxes);
 * - `storyteller-has`: the waking player has no ability, so a jinx gives the Storyteller their
 *   ability and the Storyteller makes the choice (`jinx-partner-alerts.ts`: the Summoner with
 *   the Courtier or the Preacher, https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes);
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
import { actsTwiceSource } from './acts-twice.ts';
import { characterChanger } from './becomes.ts';
import { isExecution } from './death-causes.ts';
import { stopsKillingTonight } from './reminder-effects.ts';
import { noAttackState } from './demon-attack.ts';
import { ownJinxes, ownJinxRules } from './jinxes.ts';
import { jinxChosenTonight } from './jinx-choices.ts';
import {
	jinxLearnAlerts,
	jinxPartnerAlerts,
	jinxStepAlerts,
	storytellerHasAlerts
} from './jinx-partner-alerts.ts';
import type { LearnsGained, NightChoice } from '#lib/core/data/jinx-rules.ts';
import { gainedAbilities } from './gained-abilities.ts';
import { falseInfoSource } from './night-info/reliability.ts';
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
	| 'acts-twice'
	| 'no-kill'
	| 'may-skip-attack'
	| 'must-skip-attack'
	| 'final-night'
	| 'no-grimoire'
	| 'grimoire-hides'
	| 'jinx-chosen'
	| 'learns-gained'
	| 'true-info'
	| 'seating'
	| 'wakes-with'
	| 'keeps-protection'
	| 'learns-no-ability'
	| 'might-learn'
	| 'storyteller-has'
	| 'guessed'
	| 'not-shown-given'
	| 'may-mad-as'
	| 'reverts'
	| 'partner-setup'
	| 'protected'
	| 'may-bounce'
	| 'survives-first-death'
	| 'on-death';

/**
 * The alerts about what happens to a player if a killing step chooses them: protected, may
 * bounce the death, survives a first death, or dying sets off an ability. The night step shows
 * them in their own "If chosen" section, one row per player (Trevor, 2026-11-03).
 */
export const IF_CHOSEN_KINDS: ReadonlySet<NightAlertKind> = new Set([
	'protected',
	'may-bounce',
	'survives-first-death',
	'on-death'
]);

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
	/** For `jinx-chosen`: whether the chosen partner acts without dying, or dies. */
	outcome?: NightChoice['partner'];
	/** For `learns-gained`: what the player learns, the ability or its answer. */
	learns?: LearnsGained;
	/**
	 * For `learns-no-ability` and `might-learn`: the jinxed partner they learn about; for
	 * `storyteller-has`, the jinxed partner that makes the Storyteller have the ability; for
	 * `guessed`, `not-shown-given`, `may-mad-as`, `reverts` and `partner-setup`, the jinxed
	 * partner the alert is about.
	 */
	partner?: CharacterId;
}

/**
 * Whether every evil Minion and Demon sits in one unbroken line of evil players round the
 * table with `seatId` inside it, an evil player on each side (the Lord of Typhon's setup).
 * Evil Townsfolk and evil Travellers may be part of the line but need not be
 * (https://wiki.bloodontheclocktower.com/Lord_of_Typhon), so the Bounty Hunter's evil
 * Townsfolk sitting apart is no warning. Warns only.
 */
export function evilInOneLine(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	const seating = game.seating;
	const n = seating.length;
	const at = seating.indexOf(seatId);
	if (at < 0 || n < 3) return true;
	const seatAt = (i: number) => seating[((i % n) + n) % n];
	const evil = (i: number) => alignmentOf(game, seatAt(i)) === 'evil';
	if (!evil(at - 1) || !evil(at + 1)) return false;
	const line = new Set<SeatId>([seatId]);
	for (let i = 1; i < n && evil(at - i); i++) line.add(seatAt(at - i));
	for (let i = 1; i < n && evil(at + i); i++) line.add(seatAt(at + i));
	return seating.every((s) => {
		if (line.has(s) || alignmentOf(game, s) !== 'evil') return true;
		const id = trueCharacter(game, s, characters);
		const type = id === undefined ? undefined : characters.get(id)?.type;
		return type !== 'minion' && type !== 'demon';
	});
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
	// Not while its own first-night step still makes the Minions beside it (M22): the line
	// only exists once it has.
	if (
		rulesOf(characterId, characters)?.turnsPlayersInto?.players === 'neighbours' &&
		characterChanger(game, characterId, characters) === undefined
	)
		for (const seatId of actors)
			if (!evilInOneLine(game, seatId, characters))
				out.push({
					kind: 'seating',
					seatId,
					source: { characterId, seatId },
					works: true,
					impairments: []
				});
	out.push(...jinxPartnerAlerts(game, characterId, characters));
	out.push(...jinxLearnAlerts(game, characterId, characters));
	out.push(...storytellerHasAlerts(game, characterId, characters));
	for (const seatId of actors) {
		const twice = actsTwiceSource(game, seatId, characters);
		if (!twice) continue;
		const character = characters.get(twice.characterId);
		out.push(
			sourceAlert(
				game,
				'acts-twice',
				seatId,
				{
					characterId: twice.characterId,
					...(twice.seatId ? { seatId: twice.seatId } : {}),
					reminderId: twice.reminderId
				},
				characters,
				character && wikiUrl(character)
			)
		);
	}
	let noKill = false;
	for (const seatId of actors) {
		for (const r of game.seats[seatId].reminders) {
			const rules = rulesOf(r.characterId, characters);
			let waking = rules?.stopsWaking?.token === r.label;
			const stops = waking ? rules?.stopsWaking : rules?.stopsKilling;
			// Or the effect the Storyteller picked for it, on its own night (`pickedEffect`).
			const picked = !waking && stopsKillingTonight(r.effect, game);
			if (!picked && stops?.token !== r.label) continue;
			if (!picked && stops?.type && typeOf(game, seatId, characters) !== stops.type) continue;
			// A jinx may make a token that stops waking stop the kill too (the Exorcist's Chosen
			// on the Yaggababble, https://wiki.bloodontheclocktower.com/Yaggababble#Related_Jinxes).
			if (waking && ownJinxRules(game, characterId, r.characterId, characters)?.noKill === 'token')
				waking = false;
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

	out.push(...grimoireAlerts(game, characterId, actors, characters));
	out.push(...jinxChoiceAlerts(game, characterId, actors, characters));
	out.push(...learnsGainedAlerts(game, characterId, actors, characters));
	out.push(...trueInfoAlerts(game, characterId, actors, characters));

	const killer = nightKiller(characterId, characters);
	out.push(...jinxStepAlerts(game, characterId, actors, killer?.by === 'demon', characters));
	if (killer?.by === 'demon') {
		const stopped = executedPartnerStops(game, characters);
		for (const seatId of actors)
			for (const source of stopped)
				out.push(
					sourceAlert(game, 'no-kill', seatId, source, characters, wikiOf(source, characters))
				);
		if (stopped.length > 0) noKill = true;
	}
	if (killer?.by === 'demon' && !noKill)
		for (const seatId of actors) {
			const state = noAttackState(game, seatId, characters);
			if (!state) continue;
			if (state.finalNight) noKill = true;
			const kind = state.finalNight
				? 'final-night'
				: state.pending
					? 'must-skip-attack'
					: 'may-skip-attack';
			const character = characters.get(state.rule.characterId);
			out.push(
				sourceAlert(
					game,
					kind,
					seatId,
					{
						characterId: state.rule.characterId,
						...(state.pending ? { reminderId: state.pending } : {})
					},
					characters,
					character && wikiUrl(character)
				)
			);
		}
	if (!killer || noKill) return out;
	const subjects = (killer.targets === 'self' ? actors : game.seating).filter(
		(s) => getSeat(game, s)?.dead === false
	);
	for (const seatId of subjects) out.push(...deathAlerts(game, seatId, killer, characters));
	return out;
}

/** The character's wiki page, when it has one. */
function wikiOf(source: AbilitySource, characters: CharacterLookup): string | undefined {
	const character = characters.get(source.characterId);
	return character && wikiUrl(character);
}

/**
 * The players whose jinx stops the Demon killing tonight because they nominated a jinxed
 * partner today who died by execution (`noKill: 'executed-partner'`: the Cannibal and the
 * Princess, https://wiki.bloodontheclocktower.com/Cannibal#Related_Jinxes), from today's log.
 */
function executedPartnerStops(game: Game, characters: CharacterLookup): AbilitySource[] {
	const entries = game.today.entries;
	return game.seating.flatMap((nominator) => {
		const own = trueCharacter(game, nominator, characters);
		if (!own) return [];
		const partners = ownJinxes(game, own, (r) => r.noKill === 'executed-partner', characters);
		const hit = entries.some(
			(e) =>
				e.kind === 'nomination' &&
				e.nominator === nominator &&
				partners.some((p) => trueCharacter(game, e.nominee, characters) === p.partner) &&
				entries.some((x) => x.kind === 'execution' && x.seatId === e.nominee && x.died)
		);
		return hit ? [{ characterId: own, seatId: nominator }] : [];
	});
}

/**
 * What a jinx changes about the Grimoire the waking character's player sees (`noGrimoire`,
 * `grimoireHides`): not seen while the partner has its ability (a dead partner has none), or
 * these players' tokens come off it first.
 */
function grimoireAlerts(
	game: Game,
	characterId: CharacterId,
	actors: readonly SeatId[],
	characters: CharacterLookup
): NightAlert[] {
	const out: NightAlert[] = [];
	const holders = (id: CharacterId) =>
		game.seating.filter((s) => trueCharacter(game, s, characters) === id);
	for (const { partner, rule } of ownJinxes(
		game,
		characterId,
		(r) => r.noGrimoire === true || r.grimoireHides !== undefined,
		characters
	)) {
		if (rule.noGrimoire) {
			for (const at of holders(partner)) {
				if (abilityState(game, at, characters).dead) continue;
				const source = { characterId: partner, seatId: at };
				for (const seatId of actors)
					out.push(
						sourceAlert(game, 'no-grimoire', seatId, source, characters, wikiOf(source, characters))
					);
			}
		}
		const hides = rule.grimoireHides ?? [];
		if (hides.length === 0 || actors.length === 0) continue;
		// Only while the partner is in play: with no Magician, the Demon's token stays.
		const from = holders(partner)[0];
		if (from === undefined) continue;
		const source: AbilitySource = { characterId: partner, seatId: from };
		for (const seatId of game.seating) {
			const hidden =
				(hides.includes('partner') && trueCharacter(game, seatId, characters) === partner) ||
				hides.some((h) => h !== 'partner' && typeOf(game, seatId, characters) === h);
			if (!hidden) continue;
			// The jinx itself takes the token off, whatever the partner's ability's state.
			const alert: NightAlert = {
				kind: 'grimoire-hides',
				seatId,
				source,
				works: true,
				impairments: []
			};
			const wiki = wikiOf(source, characters);
			if (wiki) alert.wiki = wiki;
			out.push(alert);
		}
	}
	return out;
}

/**
 * A partner a jinx's night choice picked tonight (`jinxChosenTonight`), at the partner's
 * step (its own player) and at the chooser's. The jinx itself applies it, whatever the
 * chooser's ability's state.
 */
function jinxChoiceAlerts(
	game: Game,
	characterId: CharacterId,
	actors: readonly SeatId[],
	characters: CharacterLookup
): NightAlert[] {
	return jinxChosenTonight(game, characters)
		.filter(
			(c) =>
				c.by.characterId === characterId || (c.partner === characterId && actors.includes(c.seatId))
		)
		.map((c) => {
			const source: AbilitySource = c.by;
			const alert: NightAlert = {
				kind: 'jinx-chosen',
				seatId: c.seatId,
				source,
				works: true,
				impairments: [],
				outcome: c.outcome
			};
			const wiki = wikiOf(source, characters);
			if (wiki) alert.wiki = wiki;
			return alert;
		});
}

/**
 * What a jinx has the waking player learn tonight about an ability they gained today
 * (`learnsGainedTonight`), at the step of the character they gained it by. Its source is the
 * gained character on their own seat, so a drunk or poisoned holder says so.
 */
function learnsGainedAlerts(
	game: Game,
	characterId: CharacterId,
	actors: readonly SeatId[],
	characters: CharacterLookup
): NightAlert[] {
	return gainedAbilities(game, characters)
		.filter((g) => g.learns && g.via === characterId && actors.includes(g.seatId))
		.map((g) => {
			const source: AbilitySource = { characterId: g.characterId, seatId: g.seatId };
			const alert = sourceAlert(game, 'learns-gained', g.seatId, source, characters, undefined);
			const wiki = wikiOf({ characterId }, characters);
			return { ...alert, ...(wiki ? { wiki } : {}), learns: g.learns };
		});
}

/**
 * A character whose false information would cover the waking character's, but whose jinx with
 * it keeps it true (`trueInfo`): the Vortox and the Banshee's announcement.
 */
function trueInfoAlerts(
	game: Game,
	characterId: CharacterId,
	actors: readonly SeatId[],
	characters: CharacterLookup
): NightAlert[] {
	const type = characters.get(characterId)?.type;
	const by = type === undefined ? undefined : falseInfoSource(game, characters, type);
	if (!by || !ownJinxRules(game, by.characterId, characterId, characters)?.trueInfo) return [];
	return actors.map((seatId) =>
		sourceAlert(game, 'true-info', seatId, by, characters, wikiOf(by, characters))
	);
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
		// A player a working protection keeps safe doesn't die: no kill to move elsewhere (the
		// Monk's Mayor example: https://wiki.bloodontheclocktower.com/Monk) and no first death
		// spent (https://wiki.bloodontheclocktower.com/Fool, Example 3).
		const safe = protection(game, seatId, characters, killer.by);
		const redirect = safe ? undefined : killRedirect(game, seatId, characters, killer.by);
		if (redirect) alert('may-bounce', redirect, wikiOf(redirect));
		const saver = safe ? undefined : firstDeathSaver(game, seatId, characters);
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
