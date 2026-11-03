/**
 * Night alerts a jinx adds at its partner's step, for this character's player (its effects
 * from either file of the pair, `data/jinx-rules.ts`):
 * - `wakes-with` (`learns: "partner-choice"`): the player wakes with the partner and learns
 *   whom it chooses (the Vizier with the Fearmonger,
 *   https://wiki.bloodontheclocktower.com/Vizier#Related_Jinxes);
 * - `keeps-protection` (`keepsProtection`): the partner's ability has taken this player's
 *   ability away, so they learn this, and their protection still holds (the Vizier with the
 *   Courtier and the Preacher still can't die by day).
 * The jinx itself applies each one, so they work whatever the owner's ability's state. Data
 * only, no wording: `NightAlerts.svelte` says them.
 */
import type { JinxEffect } from '#lib/core/data/jinx-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import { scriptCharacterIds, type CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState } from './ability.ts';
import { jinxEffect, ownJinxEffects, ownJinxRules } from './jinxes.ts';
import { jinxApplies } from './jinx-when.ts';
import {
	gainedApplies,
	gainedPartnerJinx,
	jinxGuessers,
	madAsPartners,
	notShownGiven,
	secondDemonReverts
} from './jinx-effects.ts';
import type { NightAlert } from './night-alerts.ts';

/** The `wakes-with` and `keeps-protection` alerts at the step of `partner`, in seating order. */
export function jinxPartnerAlerts(
	game: Game,
	partner: CharacterId,
	characters: CharacterLookup
): NightAlert[] {
	const out: NightAlert[] = [];
	for (const seatId of game.seating) {
		const owner = trueCharacter(game, seatId, characters);
		if (owner === undefined || game.seats[seatId].dead) continue;
		const rule = ownJinxRules(game, owner, partner, characters);
		if (!rule) continue;
		const state = abilityState(game, seatId, characters);
		const kinds: NightAlert['kind'][] = [];
		const applies = (effect: JinxEffect | undefined) =>
			effect !== undefined && jinxApplies(game, owner, partner, effect, characters, { seatId });
		if (rule.learns?.what === 'partner-choice' && applies(rule.learns)) kinds.push('wakes-with');
		if (
			applies(rule.keepsProtection) &&
			state.impairments.some((i) => i.source.characterId === partner)
		)
			kinds.push('keeps-protection');
		const character = characters.get(owner);
		for (const kind of kinds)
			out.push({
				kind,
				seatId,
				source: { characterId: owner, seatId },
				works: true,
				impairments: [],
				...(character ? { wiki: `${wikiUrl(character)}#Related_Jinxes` } : {})
			});
	}
	return out;
}

/**
 * The alerts at `characterId`'s step that a jinx lets a player learn about a partner
 * (https://wiki.bloodontheclocktower.com/Legion#Related_Jinxes), in seating order:
 * - `learns-no-ability` (`learns: "no-ability"`, while its `when` holds): the waking player
 *   learns the partner took their ability (with `{"night": 1}`, the Engineer with Legion);
 * - `learns-alignment` (`learns: "alignment"`, while its `when` holds for that player): the
 *   waking player learns which alignment they are (`alignment`: the Ogre whose Friend is the
 *   Recluse, registering as evil, learns they are evil,
 *   https://wiki.bloodontheclocktower.com/Ogre#Related_Jinxes);
 * - `might-learn` (`partnerKeepsAbility`): one of this player's `impairs` tokens would reach
 *   a partner's player, who keeps their ability, so this player might learn the partner is in
 *   play; at this player's step and at the partner's (the Minstrel and the Preacher with
 *   Legion).
 */
export function jinxLearnAlerts(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): NightAlert[] {
	const out: NightAlert[] = [];
	const alert = (
		kind: NightAlert['kind'],
		seatId: SeatId,
		owner: CharacterId,
		partner: CharacterId
	): NightAlert => {
		const character = characters.get(owner);
		return {
			kind,
			seatId,
			source: { characterId: owner, seatId },
			works: true,
			impairments: [],
			partner,
			...(character ? { wiki: `${wikiUrl(character)}#Related_Jinxes` } : {})
		};
	};
	for (const seatId of game.seating) {
		const owner = trueCharacter(game, seatId, characters);
		if (owner === undefined) continue;
		if (owner === characterId && !game.seats[seatId].dead) {
			const impairs = abilityState(game, seatId, characters).impairments;
			const learns = ownJinxEffects(
				game,
				owner,
				'learns',
				characters,
				(e) => e.what === 'no-ability'
			);
			for (const { partner } of learns)
				if (impairs.some((i) => i.source.characterId === partner))
					out.push(alert('learns-no-ability', seatId, owner, partner));
			const alignment = alignmentOf(game, seatId);
			for (const partner of learnsAlignmentFrom(game, owner, seatId, characters))
				if (alignment)
					out.push({ ...alert('learns-alignment', seatId, owner, partner), alignment });
		}
		const spared = ownJinxEffects(game, owner, 'partnerKeepsAbility', characters);
		for (const { partner } of spared) {
			if (characterId !== owner && characterId !== partner) continue;
			if (wouldImpair(game, owner, partner, characters))
				out.push(alert('might-learn', seatId, owner, partner));
		}
	}
	return out;
}

/** The partners whose jinx has `seatId`, an `owner` player, learn their alignment now. */
function learnsAlignmentFrom(
	game: Game,
	owner: CharacterId,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId[] {
	return scriptCharacterIds(game.script).flatMap((partner) => {
		const effect = jinxEffect(game, owner, partner, 'learns', characters, { seatId });
		return effect?.what === 'alignment' ? [partner] : [];
	});
}

/**
 * The alerts at `characterId`'s step about who carries its `carrierIsDemon` token, one per
 * jinx whose `when` holds, about the partner's (first living) player:
 * - `storyteller-chooses` (`storytellerChooses` with `what: "carrier"`): the Storyteller, not
 *   the players who wake, chooses who carries it (the Magician's Lil' Monsta,
 *   https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes);
 * - `wakes-one-by-one` (`wakesOneByOne`): the players who wake for it wake one at a time,
 *   until one chooses to take it (the Poppy Grower's Lil' Monsta,
 *   https://wiki.bloodontheclocktower.com/Poppy_Grower#Related_Jinxes).
 * Each says the character type that may carry it when a `carriedBy` jinx with that partner
 * names one now (`type`: a Minion).
 */
export function carrierChoiceAlerts(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): NightAlert[] {
	if (rulesOf(characterId, characters)?.carrierIsDemon === undefined) return [];
	const found = [
		...ownJinxEffects(
			game,
			characterId,
			'storytellerChooses',
			characters,
			(e) => e.what === 'carrier'
		).map((j) => ({ kind: 'storyteller-chooses' as const, partner: j.partner })),
		...ownJinxEffects(game, characterId, 'wakesOneByOne', characters).map((j) => ({
			kind: 'wakes-one-by-one' as const,
			partner: j.partner
		}))
	];
	return found.flatMap(({ kind, partner }) => {
		const seats = game.seating.filter((s) => trueCharacter(game, s, characters) === partner);
		const seatId = seats.find((s) => !game.seats[s].dead) ?? seats[0];
		if (seatId === undefined) return [];
		const type = jinxEffect(game, characterId, partner, 'carriedBy', characters)?.type;
		const character = characters.get(partner);
		return [
			{
				kind,
				seatId,
				source: { characterId },
				works: true,
				impairments: [],
				partner,
				...(type ? { type } : {}),
				...(character ? { wiki: `${wikiUrl(character)}#Related_Jinxes` } : {})
			}
		];
	});
}

/** Whether one of `owner`'s `impairs` tokens on the board would reach a `partner` player. */
function wouldImpair(
	game: Game,
	owner: CharacterId,
	partner: CharacterId,
	characters: CharacterLookup
): boolean {
	const tokens = rulesOf(owner, characters)?.impairs?.tokens ?? {};
	const partners = game.seating.filter((s) => trueCharacter(game, s, characters) === partner);
	return game.seating.some((on) =>
		game.seats[on].reminders.some((r) => {
			const rule = r.characterId === owner ? tokens[r.label] : undefined;
			if (!rule) return false;
			return rule.on === 'others' ? partners.some((p) => p !== on) : partners.includes(on);
		})
	);
}

/**
 * The `storyteller-has` alert at `characterId`'s step (`storytellerHas` once `no-ability`): its
 * living player has no ability (drunk, poisoned or without one), so the Storyteller has its
 * ability and makes its choices (the Summoner with the Courtier or the Preacher,
 * https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes). `partner` is the jinxed
 * character that took the ability, else the first on the script.
 */
export function storytellerHasAlerts(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): NightAlert[] {
	const partners = ownJinxEffects(
		game,
		characterId,
		'storytellerHas',
		characters,
		(e) => e.once === 'no-ability'
	).map((j) => j.partner);
	if (partners.length === 0) return [];
	const character = characters.get(characterId);
	return game.seating.flatMap((seatId) => {
		if (game.seats[seatId].dead || trueCharacter(game, seatId, characters) !== characterId)
			return [];
		const impairments = abilityState(game, seatId, characters).impairments;
		if (impairments.length === 0) return [];
		const partner =
			partners.find((p) => impairments.some((i) => i.source.characterId === p)) ?? partners[0];
		return [
			{
				kind: 'storyteller-has' as const,
				seatId,
				source: { characterId, seatId },
				works: true,
				impairments: [],
				partner,
				...(character ? { wiki: `${wikiUrl(character)}#Related_Jinxes` } : {})
			}
		];
	});
}

/**
 * More alerts a jinx adds at `characterId`'s step (L119), in seating order:
 * - `guessed` (`guessesPartner`), at a Demon's killing step: a living player may have publicly
 *   guessed a living player as the partner after today's execution; if right, the Demon must
 *   choose that player tonight (the Alchemist-Spy, -Widow and -Wraith, the Magician with the
 *   Wraith, https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes);
 * - `not-shown-given` (`notShownGiven`), at the partner's step: this player has the partner's
 *   ability but isn't shown the ability it gave (the Alchemist-Boffin);
 * - `may-mad-as` (`madAsPartner`), at this character's step: its madness may be about the
 *   partner (the Cerenovus with the Goblin,
 *   https://wiki.bloodontheclocktower.com/Cerenovus#Related_Jinxes);
 * - `reverts` (`notSecondDemon`), at the partner's step: this player carries their own
 *   `becomes` token while a living player is the partner, so they are their own character again
 *   (the Scarlet Woman with the Fang Gu or the Al-Hadikhia);
 * - `partner-setup` (`partnerSetup`), at the partner's step: a player
 *   who gained the partner's ability in play (`gainedFrom`) may make its setup change now (the
 *   Philosopher with the Bounty Hunter's: a Townsfolk might turn evil,
 *   https://wiki.bloodontheclocktower.com/Philosopher#Related_Jinxes).
 * `demonKills` says whether this step is a Demon's kill. The jinx itself applies each one.
 */
export function jinxStepAlerts(
	game: Game,
	characterId: CharacterId,
	actors: readonly SeatId[],
	demonKills: boolean,
	characters: CharacterLookup
): NightAlert[] {
	const alert = (
		kind: NightAlert['kind'],
		seatId: SeatId,
		owner: CharacterId,
		partner: CharacterId,
		wikiOf: CharacterId = owner
	): NightAlert => {
		const character = characters.get(wikiOf);
		return {
			kind,
			seatId,
			source: { characterId: owner, seatId },
			works: true,
			impairments: [],
			partner,
			...(character ? { wiki: `${wikiUrl(character)}#Related_Jinxes` } : {})
		};
	};
	const out: NightAlert[] = [];
	if (demonKills && actors.length > 0)
		for (const g of jinxGuessers(game, characters))
			out.push(alert('guessed', g.seatId, g.owner, g.partner));
	for (const n of notShownGiven(game, characters))
		if (n.partner === characterId) out.push(alert('not-shown-given', n.seatId, n.owner, n.partner));
	const mad = madAsPartners(game, characterId, characters);
	for (const seatId of actors)
		for (const partner of mad) out.push(alert('may-mad-as', seatId, characterId, partner));
	for (const r of secondDemonReverts(game, characters))
		if (r.partner === characterId) out.push(alert('reverts', r.seatId, r.owner, r.partner));
	for (const seatId of game.seating) {
		const gained = gainedPartnerJinx(game, seatId, characters);
		if (gained?.partner !== characterId) continue;
		if (!gainedApplies(game, seatId, gained, gained.rule.partnerSetup, characters)) continue;
		if (rulesOf(gained.owner, characters)?.gainedFrom === undefined) continue;
		if (rulesOf(characterId, characters)?.setupModifier === undefined) continue;
		out.push(alert('partner-setup', seatId, gained.owner, characterId));
	}
	return out;
}
