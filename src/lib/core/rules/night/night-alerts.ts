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
 * - `missing-token`: the waking player has the ability of an evil player, so they should carry
 *   their own `ifEvil` reminder, and don't (`gainedFrom`: the Cannibal without Poisoned after
 *   an evil lunch, https://wiki.bloodontheclocktower.com/Cannibal#How_to_Run; warn, never lock);
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
 * - `storyteller-chooses` / `wakes-one-by-one`: a jinx says the Storyteller chooses who carries
 *   this character's `carrierIsDemon` token, or that the players who wake for it wake one at a
 *   time (`jinx-partner-alerts.ts`: Lil' Monsta with the Magician or the Poppy Grower,
 *   https://wiki.bloodontheclocktower.com/Lil%27_Monsta#Related_Jinxes);
 * - `learns-alignment`: a jinx has the waking player learn their alignment (the Ogre whose
 *   Friend is the Recluse, registering as evil, https://wiki.bloodontheclocktower.com/Ogre);
 * - `learns-character`, `cannot-choose`, `storyteller-redirects` (M44, a custom script's
 *   jinxes): the waking player also learns a partner's player's true character, can't choose
 *   a partner's player, or would have their choice of one moved by the Storyteller to another
 *   player (`jinx-partner-alerts.ts`); a partner who chose them tonight is a `no-kill`
 *   (`noKill` `chosen`, `jinx-targets.ts`);
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
import type { CharacterId } from '#lib/core/data/types.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, getSeat, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { actsTwiceSource } from '#lib/core/rules/abilities/acts-twice.ts';
import { characterChanger } from '#lib/core/rules/abilities/becomes.ts';
import { stopsKillingTonight } from '#lib/core/rules/reminders/reminder-effects.ts';
import { noAttackState } from './demon-attack.ts';
import { jinxEffect } from '#lib/core/rules/jinxes/jinxes.ts';
import { chosenStopsKill } from '#lib/core/rules/jinxes/jinx-targets.ts';
import {
	carrierChoiceAlerts,
	jinxChoiceRuleAlerts,
	jinxLearnAlerts,
	jinxPartnerAlerts,
	jinxStepAlerts,
	storytellerHasAlerts
} from '#lib/core/rules/jinxes/jinx-partner-alerts.ts';
import { abilityHolders } from '#lib/core/rules/abilities/gained-abilities.ts';
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';
import { type NightAlert, sourceAlert, wikiOf } from './night-alert.ts';
import { deathAlerts, demonKillStops } from './kill-alerts.ts';
import { nightKiller } from './night-killers.ts';
import {
	grimoireAlerts,
	jinxChoiceAlerts,
	learnsGainedAlerts,
	missingTokenAlerts,
	trueInfoAlerts
} from './step-jinx-alerts.ts';

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

/**
 * Seats that wake for `characterId`: those with its ability (`abilityHolders`, gained or held
 * too), or its token (a Drunk who thinks they are it).
 */
function actorSeats(game: Game, characterId: CharacterId, characters: CharacterLookup): SeatId[] {
	const holders = abilityHolders(game, characterId, characters);
	return game.seating.filter(
		(s) => holders.includes(s) || game.seats[s]?.characterId === characterId
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
		rulesFor(game, characterId, characters)?.turnsPlayersInto?.players === 'neighbours' &&
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
	out.push(...carrierChoiceAlerts(game, characterId, characters));
	out.push(...jinxChoiceRuleAlerts(game, characterId, characters));
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
			const rules = rulesFor(game, r.characterId, characters);
			let waking = rules?.stopsWaking?.token === r.label;
			const stops = waking ? rules?.stopsWaking : rules?.stopsKilling;
			// Or the effect the Storyteller picked for it, on its own night (`pickedEffect`).
			const picked = !waking && stopsKillingTonight(r.effect, game);
			if (!picked && stops?.token !== r.label) continue;
			if (!picked && stops?.type && typeOf(game, seatId, characters) !== stops.type) continue;
			// A jinx may make a token that stops waking stop the kill too (the Exorcist's Chosen
			// on the Yaggababble, https://wiki.bloodontheclocktower.com/Yaggababble#Related_Jinxes).
			if (
				waking &&
				jinxEffect(game, characterId, r.characterId, 'noKill', characters)?.on === 'token'
			)
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
		// A jinx partner who chose this player tonight stops the kill (`noKill` `chosen`).
		const chosen = chosenStopsKill(game, seatId, characterId, characters);
		if (!chosen) continue;
		noKill = true;
		const shown = out.some(
			(a) =>
				a.kind === 'no-kill' &&
				a.seatId === seatId &&
				a.source !== 'override' &&
				a.source.reminderId === chosen.reminderId
		);
		if (!shown)
			out.push(
				sourceAlert(game, 'no-kill', seatId, chosen, characters, wikiOf(chosen, characters))
			);
	}

	out.push(...grimoireAlerts(game, characterId, actors, characters));
	out.push(...jinxChoiceAlerts(game, characterId, actors, characters));
	out.push(...learnsGainedAlerts(game, characterId, actors, characters));
	out.push(...missingTokenAlerts(game, characterId, actors, characters));
	out.push(...trueInfoAlerts(game, characterId, actors, characters));

	const killer = nightKiller(characterId, characters);
	out.push(...jinxStepAlerts(game, characterId, actors, killer?.by === 'demon', characters));
	if (killer?.by === 'demon') {
		const stopped = demonKillStops(game, characters);
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
	for (const seatId of subjects)
		out.push(...deathAlerts(game, seatId, characterId, killer, characters));
	return out;
}
