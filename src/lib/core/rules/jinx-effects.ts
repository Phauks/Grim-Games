/**
 * What the Alchemist's and the other one-off jinxes do to players (L119), split from
 * `jinxes.ts`; each is read from the owner's side of the `jinxes` block (`data/jinx-rules.ts`):
 * an ability a player has from their token taken away or made drunk, a guess that makes the
 * Demon choose, an ability not shown, a second Demon not made, an ability kept, a kill that
 * reaches a marked player, a madness allowed, a setup change made, a vote not counted, a Minion
 * hidden at Demon info, and a gained ability's end.
 */
import type { JinxRules } from '#lib/core/data/jinx-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterRules } from '#lib/core/data/character-rules.ts';
import type { Alignment, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { ownJinxes, ownJinxRules } from './jinxes.ts';

type RulesLookup = ReadonlyMap<CharacterId, { rules?: CharacterRules }>;

/** A jinx on the ability a player has from the token on their seat (`gainedPartnerJinx`). */
export interface GainedPartnerJinx {
	/** The player's true character, whose jinx it is (the Alchemist). */
	owner: CharacterId;
	/** The character whose ability they have, their seat's token (the Spy). */
	partner: CharacterId;
	rule: JinxRules;
}

/**
 * The jinx between `seatId`'s true character and the character whose ability they have from
 * the token on their seat: one their own `gainsAbilityOf` lets them have (the Alchemist's
 * Minion, https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes), or one their
 * `gainedFrom` swapped in (the Philosopher's good character). Undefined when they have no such
 * ability, or no jinx with it is on the script.
 */
export function gainedPartnerJinx(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): GainedPartnerJinx | undefined {
	const shown = game.seats[seatId]?.characterId;
	const owner = trueCharacter(game, seatId, characters);
	if (owner === undefined || shown === undefined || owner === shown) return undefined;
	const rules = rulesOf(owner, characters);
	const type = characters.get(shown)?.type;
	const gains =
		(rules?.gainsAbilityOf !== undefined && rules.gainsAbilityOf === type) ||
		rules?.gainedFrom?.swapped === true;
	if (!gains) return undefined;
	const rule = ownJinxRules(game, owner, shown, characters);
	return rule ? { owner, partner: shown, rule } : undefined;
}

/**
 * The partner whose jinx takes `seatId`'s ability away while they have it from their token
 * (`withPartnerAbility` `partner-in-play` or `no-ability`: the Alchemist-Marionette, -Spy,
 * -Widow, -Wraith and -Mastermind have no ability,
 * https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes). Undefined otherwise.
 */
export function gainedAbilityTaken(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	const gained = gainedPartnerJinx(game, seatId, characters);
	const need = gained?.rule.withPartnerAbility;
	return need === 'partner-in-play' || need === 'no-ability' ? gained?.partner : undefined;
}

/**
 * The other player in a `both-drunk` jinx with `seatId` (the Alchemist with the Organ Grinder
 * ability and the real Organ Grinder: "If both are sober, both are drunk",
 * https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes), with the partner's
 * character. Each is drunk while neither is otherwise drunk or poisoned (`abilityState`).
 */
export function bothDrunkPair(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): { other: SeatId; partner: CharacterId } | undefined {
	const own = gainedPartnerJinx(game, seatId, characters);
	if (own?.rule.withPartnerAbility === 'both-drunk') {
		const other = game.seating.find(
			(s) => s !== seatId && trueCharacter(game, s, characters) === own.partner
		);
		return other === undefined ? undefined : { other, partner: own.partner };
	}
	const self = trueCharacter(game, seatId, characters);
	if (self === undefined) return undefined;
	const other = game.seating.find((s) => {
		if (s === seatId) return false;
		const gained = gainedPartnerJinx(game, s, characters);
		return gained?.partner === self && gained.rule.withPartnerAbility === 'both-drunk';
	});
	return other === undefined ? undefined : { other, partner: self };
}

/** A player who may publicly guess a jinxed partner after today's execution (`jinxGuessers`). */
export interface JinxGuesser {
	seatId: SeatId;
	/** Their true character, whose jinx it is (the Alchemist, the Magician). */
	owner: CharacterId;
	/** The character they may guess (the Spy, the Widow, the Wraith). */
	partner: CharacterId;
	/** The living players who are the partner: the Demon must choose one if they are named. */
	partnerSeats: SeatId[];
}

/**
 * The players who may publicly guess a living player as a jinxed partner now, after today's
 * execution (`guessesPartner`): a living player of the jinx's owner, who with
 * `withPartnerAbility` must have the partner's ability from their token (the Alchemist-Spy,
 * -Widow and -Wraith, the Magician with the Wraith,
 * https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes). If they name one of
 * `partnerSeats`, the Demon must choose that player tonight. None until someone has been
 * executed today, or while no living player is the partner.
 */
export function jinxGuessers(game: Game, characters: CharacterLookup): JinxGuesser[] {
	if (!game.today.entries.some((e) => e.kind === 'execution')) return [];
	return game.seating.flatMap((seatId) => {
		const owner = trueCharacter(game, seatId, characters);
		if (owner === undefined || game.seats[seatId].dead) return [];
		const gained = gainedPartnerJinx(game, seatId, characters);
		return ownJinxes(game, owner, (r) => r.guessesPartner === true, characters).flatMap(
			({ partner, rule }) => {
				if (rule.withPartnerAbility !== undefined && gained?.partner !== partner) return [];
				const partnerSeats = game.seating.filter(
					(s) =>
						s !== seatId && !game.seats[s].dead && trueCharacter(game, s, characters) === partner
				);
				return partnerSeats.length > 0 ? [{ seatId, owner, partner, partnerSeats }] : [];
			}
		);
	});
}

/**
 * The players not shown the ability a partner's `givesAbility` gave, though they have that
 * partner's ability from their token (`notShownGiven`: the Alchemist-Boffin doesn't learn what
 * ability the Demon has, https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes), each
 * with that partner.
 */
export function notShownGiven(
	game: Game,
	characters: CharacterLookup
): { seatId: SeatId; owner: CharacterId; partner: CharacterId }[] {
	return game.seating.flatMap((seatId) => {
		const gained = gainedPartnerJinx(game, seatId, characters);
		return gained?.rule.notShownGiven
			? [{ seatId, owner: gained.owner, partner: gained.partner }]
			: [];
	});
}

/**
 * The partner whose living player means `owner`'s `becomes` token doesn't fit `seatId`, as it
 * would make a second Demon (`notSecondDemon`: the Scarlet Woman stays, or becomes again, the
 * Scarlet Woman while a living player is the Fang Gu or the Al-Hadikhia,
 * https://wiki.bloodontheclocktower.com/Scarlet_Woman#Related_Jinxes). Undefined otherwise.
 */
export function secondDemonPartner(
	game: Game,
	owner: CharacterId,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	return ownJinxes(game, owner, (r) => r.notSecondDemon === true, characters).find(({ partner }) =>
		game.seating.some(
			(s) => s !== seatId && !game.seats[s].dead && trueCharacter(game, s, characters) === partner
		)
	)?.partner;
}

/**
 * The living players carrying their own character's `becomes` token while a jinx says it makes
 * no second Demon (`secondDemonPartner`), so they become their own character again (the
 * Scarlet Woman whose Al-Hadikhia came back to life), each with that partner.
 */
export function secondDemonReverts(
	game: Game,
	characters: CharacterLookup
): { seatId: SeatId; owner: CharacterId; partner: CharacterId }[] {
	return game.seating.flatMap((seatId) => {
		const owner = trueCharacter(game, seatId, characters);
		const token = owner === undefined ? undefined : rulesOf(owner, characters)?.becomes?.token;
		if (owner === undefined || token === undefined || game.seats[seatId].dead) return [];
		if (!game.seats[seatId].reminders.some((r) => r.characterId === owner && r.label === token))
			return [];
		const partner = secondDemonPartner(game, owner, seatId, characters);
		return partner ? [{ seatId, owner, partner }] : [];
	});
}

/**
 * Whether a jinx keeps `seatId`'s ability after the player whose `keepsAbility` token kept it
 * has died (`keepsAfterPartner`: a Mastermind the Vigormortis killed keeps their ability if the
 * Vigormortis dies, https://wiki.bloodontheclocktower.com/Mastermind#Related_Jinxes): their
 * true character's jinx with the token's character.
 */
export function keptAfterPartner(
	game: Game,
	seatId: SeatId,
	tokenOwner: CharacterId,
	characters?: CharacterLookup
): boolean {
	const own = characters
		? trueCharacter(game, seatId, characters)
		: game.seats[seatId]?.characterId;
	if (own === undefined) return false;
	return ownJinxRules(game, own, tokenOwner, characters)?.keepsAfterPartner === true;
}

/**
 * The partner whose living player keeps `seatId` alive though the carrier of their own
 * `gameEnd.aliveWhileDead.whileCarrierAlive` token has died by execution
 * (`survivesCarrierExecuted`: with the Mastermind alive, the Lleech lives on with no ability
 * when its host is executed, https://wiki.bloodontheclocktower.com/Lleech#Related_Jinxes).
 * Every carrier is dead and one of them died by execution. Undefined otherwise.
 */
export function survivesCarrierBy(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	const owner = trueCharacter(game, seatId, characters);
	const token =
		owner === undefined
			? undefined
			: rulesOf(owner, characters)?.gameEnd?.aliveWhileDead?.whileCarrierAlive;
	if (owner === undefined || token === undefined) return undefined;
	const carriers = game.seating.filter(
		(s) =>
			s !== seatId &&
			game.seats[s].reminders.some((r) => r.characterId === owner && r.label === token)
	);
	if (carriers.length === 0 || carriers.some((s) => !game.seats[s].dead)) return undefined;
	const executed = [...game.pastDays, game.today].some((log) =>
		log.entries.some((e) => e.kind === 'execution' && carriers.includes(e.seatId) && e.died)
	);
	if (!executed) return undefined;
	return ownJinxes(game, owner, (r) => r.survivesCarrierExecuted === true, characters).find(
		({ partner }) =>
			game.seating.some(
				(s) => !game.seats[s].dead && trueCharacter(game, s, characters) === partner
			)
	)?.partner;
}

/**
 * The partner whose jinx lets `killer`'s kill reach `seatId` though its usual victim rule says
 * no: the seat carries the partner's reminder that `killsMarked` names (the Slayer's shot kills
 * the Lleech's host, https://wiki.bloodontheclocktower.com/Lleech#Related_Jinxes).
 */
export function killsMarkedBy(
	game: Game,
	killer: CharacterId,
	seatId: SeatId,
	characters?: RulesLookup
): CharacterId | undefined {
	const reminders = game.seats[seatId]?.reminders ?? [];
	return ownJinxes(game, killer, (r) => r.killsMarked !== undefined, characters).find(
		({ partner, rule }) =>
			reminders.some((r) => r.characterId === partner && r.label === rule.killsMarked)
	)?.partner;
}

/**
 * The partners `owner`'s madness may be about by a jinx, though they are not good
 * (`madAsPartner`: the Cerenovus may make a player mad that they are the Goblin,
 * https://wiki.bloodontheclocktower.com/Cerenovus#Related_Jinxes).
 */
export function madAsPartners(
	game: Pick<Game, 'script'>,
	owner: CharacterId,
	characters?: RulesLookup
): CharacterId[] {
	return ownJinxes(game, owner, (r) => r.madAsPartner === true, characters).map((j) => j.partner);
}

/**
 * The character `seatId`'s player thinks they are, when a jinx makes its setup change apply
 * (`thinksPartnerSetup`: the Marionette who thinks they are the Balloonist might have added an
 * Outsider, https://wiki.bloodontheclocktower.com/Marionette#Related_Jinxes): the token on
 * their seat, jinxed with their true character. Undefined otherwise.
 */
export function thinksPartnerSetup(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	const shown = game.seats[seatId]?.characterId;
	const owner = trueCharacter(game, seatId, characters);
	if (owner === undefined || shown === undefined || owner === shown) return undefined;
	return ownJinxRules(game, owner, shown, characters)?.thinksPartnerSetup ? shown : undefined;
}

/**
 * The partner whose eyes-closed voting lets `voter`'s player raise their hand without their
 * `voter.onlyWith` player, the vote counting only if that player voted too (`uncountedVote`:
 * the Butler with the Organ Grinder,
 * https://wiki.bloodontheclocktower.com/Butler#Related_Jinxes). `secretBy` is the character
 * whose working `voting.secret` is in effect now, if any.
 */
export function uncountedVoteBy(
	game: Pick<Game, 'script'>,
	voter: CharacterId,
	secretBy: CharacterId | undefined,
	characters?: RulesLookup
): CharacterId | undefined {
	if (secretBy === undefined) return undefined;
	return ownJinxRules(game, voter, secretBy, characters)?.uncountedVote ? secretBy : undefined;
}

/**
 * The partners whose player `owner`'s living player hides among the Demon's neighbours at
 * Demon info (`hidesPartnerSeat`: while the Magician is alive, the Demon doesn't know which
 * neighbour is the Marionette, https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes).
 */
export function hiddenPartnersOf(
	game: Pick<Game, 'script'>,
	owner: CharacterId,
	characters?: RulesLookup
): CharacterId[] {
	return ownJinxes(game, owner, (r) => r.hidesPartnerSeat === true, characters).map(
		(j) => j.partner
	);
}

/**
 * The winner a jinx gives the partner's `dead-without-demon` end for `seatId`, who has the
 * partner's ability from their token (`gainedEndWinner`: an Alchemist-Summoner who dies
 * before summoning, evil wins, https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes),
 * with that partner.
 */
export function gainedEnd(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): { partner: CharacterId; winner: Alignment } | undefined {
	const gained = gainedPartnerJinx(game, seatId, characters);
	const winner = gained?.rule.gainedEndWinner;
	return gained && winner ? { partner: gained.partner, winner } : undefined;
}
