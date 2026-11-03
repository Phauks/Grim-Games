/**
 * Jinxes on a script. If the script holds any jinxed pair, the Djinn is in play and every
 * jinx on the script is announced at the start, even for characters not in play
 * (https://wiki.bloodontheclocktower.com/Djinn). Some jinxes say only one of the pair can
 * be in play (Heretic with Baron, Godfather, Lleech, Pit-Hag, Spy, Widow:
 * https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes); those become setup
 * warnings when both are chosen.
 *
 * What a jinx changes in the app is data: the `jinxes` block of either character's rules
 * (`data/jinx-rules.ts`), or the `rules` of a script's own jinx, in effect while both are on
 * the script. Every reader asks `rulesForJinx` (`jinx-pairs.ts`): a script's own jinx replaces
 * TPI's for the pair, rules and all, and one with no rules is text, except that its wording may
 * still say only one can be in play. Each reader checks an effect's `when` (`jinx-when.ts`).
 */
import type {
	GivenInstead,
	Impairs,
	JinxEffect,
	JinxRuleKey,
	JinxRules,
	RegistersTo
} from '#lib/core/data/jinx-rules.ts';
import type { JinxIndex } from '#lib/core/data/jinxes.ts';
import { pairKey } from '#lib/core/data/parse.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type {
	Alignment,
	CharacterId,
	CharacterType,
	Jinx,
	ReminderLabel,
	Script
} from '#lib/core/data/types.ts';
import {
	isOnScript,
	scriptCharacterIds,
	type CharacterLookup
} from '#lib/core/model/characters.ts';
import { alignmentOf, aliveNeighbours, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import {
	isExclusiveJinx,
	rulesForJinx,
	scriptJinxPartners,
	type RulesLookup
} from './jinx-pairs.ts';
import { aboutHolder, jinxApplies } from './jinx-when.ts';

export { isExclusiveJinx, jinxRulesBetween, rulesForJinx } from './jinx-pairs.ts';

/**
 * A script as the readers that know no board take it: the game's `Script`, whose own jinxes
 * replace TPI's (`rulesForJinx`), or only its ids, for TPI's jinxes and our rules files.
 */
export type JinxScript = Script | readonly CharacterId[];

const idsOf = (script: JinxScript): readonly CharacterId[] =>
	Array.isArray(script) ? script : scriptCharacterIds(script as Script);
const scopeOf = (script: JinxScript): Script | undefined =>
	Array.isArray(script) ? undefined : (script as Script);

/**
 * `owner`'s jinx rules for `partner` while the game's script holds both: the effects on what
 * `owner` does, or how it is treated, with the partner, from the script's own jinx or either
 * file (`rulesForJinx`). Their `when` is left for the reader to check.
 */
export function ownJinxRules(
	game: Pick<Game, 'script'>,
	owner: CharacterId,
	partner: CharacterId,
	characters?: RulesLookup
): JinxRules | undefined {
	if (owner === partner) return undefined;
	const rule = rulesForJinx(game.script, owner, partner, characters);
	if (!rule) return undefined;
	return isOnScript(game.script, owner) && isOnScript(game.script, partner) ? rule : undefined;
}

/**
 * Every character on the script whose own jinx rules for `partner` pass `test`, with them:
 * those whose jinx changes something about `partner` (the Spy and the Widow poison the
 * Damsel, https://wiki.bloodontheclocktower.com/Damsel#Related_Jinxes).
 */
export function jinxedWith(
	game: Pick<Game, 'script'>,
	partner: CharacterId,
	test: (rule: JinxRules) => boolean,
	characters?: RulesLookup
): { characterId: CharacterId; rule: JinxRules }[] {
	return scriptCharacterIds(game.script).flatMap((characterId) => {
		const rule = ownJinxRules(game, characterId, partner, characters);
		return rule && test(rule) ? [{ characterId, rule }] : [];
	});
}

/**
 * `owner`'s own jinx rules in effect on the game's script, by partner, those passing `test`
 * (the Spy's with the Poppy Grower and the Magician change what the Spy sees,
 * https://wiki.bloodontheclocktower.com/Spy#Related_Jinxes).
 */
export function ownJinxes(
	game: Pick<Game, 'script'>,
	owner: CharacterId,
	test: (rule: JinxRules) => boolean,
	characters?: RulesLookup
): { partner: CharacterId; rule: JinxRules }[] {
	const named = (id: CharacterId) => rulesOf(id, characters)?.jinxes?.[owner] !== undefined;
	const partners = new Set([
		...Object.keys(rulesOf(owner, characters)?.jinxes ?? {}),
		...scriptCharacterIds(game.script).filter(named),
		...scriptJinxPartners(game.script, owner)
	]);
	return [...partners].flatMap((partner) => {
		const rule = ownJinxRules(game, owner, partner, characters);
		return rule && test(rule) ? [{ partner, rule }] : [];
	});
}

/**
 * `owner`'s effect `key` with `partner` in effect now: on the script, its `when` holding on
 * `game` (about `at`'s player when given), and not about a player with the partner's ability
 * (`has-partner-ability`). Undefined otherwise.
 */
export function jinxEffect<K extends Exclude<JinxRuleKey, 'exclusive'>>(
	game: Pick<Game, 'script'> & Partial<Game>,
	owner: CharacterId,
	partner: CharacterId,
	key: K,
	characters?: RulesLookup,
	at?: { seatId?: SeatId }
): NonNullable<JinxRules[K]> | undefined {
	const effect = ownJinxRules(game, owner, partner, characters)?.[key] as JinxEffect | undefined;
	if (!effect || aboutHolder(effect)) return undefined;
	const lookup = characters as CharacterLookup | undefined;
	return jinxApplies(game, owner, partner, effect, lookup, at)
		? (effect as NonNullable<JinxRules[K]>)
		: undefined;
}

/**
 * `owner`'s effects `key` in effect now, by partner: those on the script whose `when` holds on
 * `game` (`jinxApplies`). Not those about a player with the partner's ability
 * (`has-partner-ability`), which only the readers of that player apply.
 */
export function ownJinxEffects<K extends Exclude<JinxRuleKey, 'exclusive'>>(
	game: Pick<Game, 'script'> & Partial<Game>,
	owner: CharacterId,
	key: K,
	characters?: RulesLookup,
	test: (effect: NonNullable<JinxRules[K]>) => boolean = () => true
): { partner: CharacterId; effect: NonNullable<JinxRules[K]> }[] {
	const lookup = characters as CharacterLookup | undefined;
	return ownJinxes(game, owner, (r) => r[key] !== undefined, characters).flatMap(
		({ partner, rule }) => {
			const effect = rule[key] as NonNullable<JinxRules[K]>;
			const on = effect as JinxEffect;
			if (aboutHolder(on) || !test(effect)) return [];
			return jinxApplies(game, owner, partner, on, lookup) ? [{ partner, effect }] : [];
		}
	);
}

/**
 * The jinxes that impair `characterId`'s players now, by partner, in script order (`impairs`
 * whose `when` holds: the Spy or the Widow in play poisons the Damsel,
 * https://wiki.bloodontheclocktower.com/Damsel#Related_Jinxes). Not those about the ability a
 * player has from their token (`has-partner-ability`) nor about both players (`who: "both"`),
 * which `jinx-effects.ts` reads for that player.
 */
export function jinxImpairs(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): { partner: CharacterId; effect: Impairs }[] {
	return scriptCharacterIds(game.script).flatMap((partner) => {
		const effect = ownJinxRules(game, characterId, partner, characters)?.impairs;
		if (!effect || effect.who === 'both' || aboutHolder(effect)) return [];
		return jinxApplies(game, characterId, partner, effect, characters) ? [{ partner, effect }] : [];
	});
}

/**
 * How a player registers to a jinxed partner (`registersTo`), from how they register to
 * everyone else (their true alignment and type first): the jinx's alignments and types are
 * added, or with `always` replace the usual ones (the Spy always registers as evil to the
 * Ogre, https://wiki.bloodontheclocktower.com/Ogre#Related_Jinxes).
 */
export function registeredTo(
	base: { alignments: readonly Alignment[]; types: readonly CharacterType[] },
	rule: RegistersTo
): { alignments: Alignment[]; types: CharacterType[] } {
	const merge = <T>(usual: readonly T[], jinx: readonly T[] | undefined): T[] => {
		const all = !jinx ? usual : rule.always ? jinx : [...usual, ...jinx];
		return all.filter((v, i) => all.indexOf(v) === i);
	};
	return {
		alignments: merge(base.alignments, rule.alignments),
		types: merge(base.types, rule.types)
	};
}

/**
 * Whether a jinx on the game's script says the Storyteller doesn't declare `characterId` is
 * in play (`notDeclared`: the Vizier with the Alsaahir or the Investigator,
 * https://wiki.bloodontheclocktower.com/Vizier#Related_Jinxes). A jinx is in effect while
 * both are on the script, so the partner need not be in play: declaring only when it isn't
 * would tell everyone it isn't.
 */
export function notDeclared(
	game: Pick<Game, 'script'>,
	characterId: CharacterId,
	characters?: RulesLookup
): boolean {
	return ownJinxEffects(game, characterId, 'notDeclared', characters).length > 0;
}

/**
 * The partners `changer`'s `changesCharacter` may not create now (`cannotCreate` with `via:
 * "changesCharacter"`: with `{"afterDay": 5}`, the Pit-Hag's and the Hatter's Leviathan,
 * https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes). A change is made at night,
 * after the latest day, so day `n` is over once the game has reached it.
 */
export function createdTooLate(
	game: Pick<Game, 'script' | 'pastDays'>,
	changer: CharacterId,
	characters?: RulesLookup
): CharacterId[] {
	return ownJinxEffects(
		game,
		changer,
		'cannotCreate',
		characters,
		(e) => e.via === 'changesCharacter'
	).map((j) => j.partner);
}

/**
 * The character type a player `changer`'s `changesCharacter` makes into `characterId` also
 * chooses and becomes, as that partner is never dealt (`alsoBecomes`: the Hatter's Demon who
 * chooses Lil' Monsta also chooses a Minion,
 * https://wiki.bloodontheclocktower.com/Hatter#Related_Jinxes). Undefined when no jinx says so.
 */
export function alsoBecomes(
	game: Pick<Game, 'script'>,
	changer: CharacterId,
	characterId: CharacterId,
	characters?: RulesLookup
): CharacterType | undefined {
	const effect = ownJinxRules(game, changer, characterId, characters)?.alsoBecomes;
	return jinxApplies(game, changer, characterId, effect) ? effect?.type : undefined;
}

/**
 * The partner whose jinx with `owner` lets `seatId` die when executed despite `owner`'s own
 * protection (`diesWhenExecuted`, whose `when` is about this seat: with `{"marked": "Is The
 * Demon"}`, the Psychopath and the Vizier babysitting Lil' Monsta,
 * https://wiki.bloodontheclocktower.com/Lil%27_Monsta#Related_Jinxes). Undefined otherwise.
 */
export function diesWhenExecutedBy(
	game: Game,
	seatId: SeatId,
	owner: CharacterId,
	characters?: RulesLookup
): CharacterId | undefined {
	const lookup = characters as CharacterLookup | undefined;
	return ownJinxes(game, owner, (r) => r.diesWhenExecuted !== undefined, characters).find(
		({ partner, rule }) =>
			jinxApplies(game, owner, partner, rule.diesWhenExecuted, lookup, { seatId })
	)?.partner;
}

/**
 * The partner whose jinx says `seatId` doesn't carry `carrier`'s `carrierIsDemon` token
 * (`carriedBy`, while its `when` holds): with `type`, only a player of that type does (the
 * Magician's and the Poppy Grower's Lil' Monsta goes to a Minion while they live); with
 * `marked`, once a player carries that partner's reminder only they do (the Scarlet Woman
 * babysits Lil' Monsta for the rest of the game,
 * https://wiki.bloodontheclocktower.com/Lil%27_Monsta#Related_Jinxes). A seat whose type is
 * not known yet is not judged. Undefined when nothing rules it out.
 */
export function carrierJinx(
	game: Game,
	carrier: CharacterId,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	return ownJinxEffects(game, carrier, 'carriedBy', characters).find(({ partner, effect }) => {
		if (effect.type) {
			const type = typeOf(game, seatId, characters);
			return type !== undefined && type !== effect.type;
		}
		const keepers = game.seating.filter((s) =>
			game.seats[s].reminders.some((r) => r.characterId === partner && r.label === effect.marked)
		);
		return keepers.length > 0 && !keepers.includes(seatId);
	})?.partner;
}

export interface ScriptJinx extends Jinx {
	/** `official` from TPI's jinxes.json; `script` from a script entry's `jinxes`. */
	source: 'official' | 'script';
	/** The jinx forbids both characters being in play at once. */
	exclusive: boolean;
}

/**
 * Whether a jinx forbids both being in play: its rules say so, else its wording does. A
 * script's own jinx (`scope`) reads only its own rules (`rulesForJinx`).
 */
export function jinxIsExclusive(
	jinx: Jinx,
	characters?: RulesLookup,
	scope?: { jinxes?: readonly Jinx[] }
): boolean {
	const [a, b] = jinx.characters;
	const rules = rulesForJinx(scope, a, b, characters) ?? rulesForJinx(scope, b, a, characters);
	// A script's own jinx with no rules is read from its wording by `rulesForJinx` already.
	return rules || scope ? rules?.exclusive === true : isExclusiveJinx(jinx.reason);
}

/**
 * The abilities `giver`'s `givesAbility` may not give on this script: each jinxed partner
 * on it whose jinx says `cannotCreate` with `via: "givesAbility"` (the Boffin's Demon cannot have the Drunk ability,
 * https://wiki.bloodontheclocktower.com/Boffin#Related_Jinxes).
 */
export function barredAbilities(
	giver: CharacterId,
	script: JinxScript,
	characters?: RulesLookup
): CharacterId[] {
	return idsOf(script).filter((id) => {
		const effect = rulesForJinx(scopeOf(script), giver, id, characters)?.cannotCreate;
		return effect?.via === 'givesAbility' && jinxApplies(undefined, giver, id, effect);
	});
}

/**
 * What happens instead when `giver`'s `givesAbility` would give the Storyteller `ability`, by
 * their jinx on this script (`givenInstead`: the Plague Doctor's Spy goes to a Minion, its
 * Boomdandy makes a player the Boomdandy,
 * https://wiki.bloodontheclocktower.com/Plague_Doctor#Related_Jinxes). Undefined when the
 * Storyteller gains it as usual.
 */
export function givenInstead(
	giver: CharacterId,
	ability: CharacterId,
	script: JinxScript,
	characters?: RulesLookup
): GivenInstead | undefined {
	const ids = idsOf(script);
	if (giver === ability || !ids.includes(giver) || !ids.includes(ability)) return undefined;
	const effect = rulesForJinx(scopeOf(script), giver, ability, characters)?.givenInstead;
	return jinxApplies(undefined, giver, ability, effect) ? effect?.instead : undefined;
}

/**
 * The characters on the script whose jinx with `id` answers `question`: those `id` may give
 * or create while in play (`spareToken`: the Boffin's and Pit-Hag's Village Idiot), those it
 * can't turn good (`noTurnGood`), or those whose player the Storyteller picks when `id`
 * creates them (`storytellerPicksPlayer`, `storytellerChooses` with `creating: "partner"`: the
 * Pit-Hag's Damsel).
 */
export function jinxedPartners(
	id: CharacterId,
	question: 'spareToken' | 'storytellerPicksPlayer' | 'noTurnGood',
	script: JinxScript,
	characters?: RulesLookup
): CharacterId[] {
	const ids = idsOf(script);
	if (!ids.includes(id)) return [];
	return ids.filter((other) => {
		const rules = rulesForJinx(scopeOf(script), id, other, characters);
		const effect =
			question === 'storytellerPicksPlayer'
				? rules?.storytellerChooses?.what === 'player' &&
					rules.storytellerChooses.creating === 'partner'
					? rules.storytellerChooses
					: undefined
				: rules?.[question];
		return effect !== undefined && jinxApplies(undefined, id, other, effect);
	});
}

/**
 * Every jinx between characters on the script: TPI's, plus the script's own (`jinxes` on a
 * script entry). A script's jinx replaces TPI's for the same pair, wording and rules, since the
 * script author chose it (`rulesForJinx`). Order: TPI's data order, then the script's.
 */
export function scriptJinxes(
	index: JinxIndex,
	scriptIds: Iterable<CharacterId>,
	homebrewJinxes: readonly Jinx[] = [],
	characters?: RulesLookup
): ScriptJinx[] {
	const ids = new Set(scriptIds);
	const own = new Map<string, Jinx>();
	for (const jinx of homebrewJinxes) {
		const [a, b] = jinx.characters;
		if (ids.has(a) && ids.has(b) && a !== b) own.set(pairKey(a, b), jinx);
	}
	const out: ScriptJinx[] = [];
	for (const jinx of index.all) {
		const [a, b] = jinx.characters;
		if (!ids.has(a) || !ids.has(b) || own.has(pairKey(a, b))) continue;
		out.push({ ...jinx, source: 'official', exclusive: jinxIsExclusive(jinx, characters) });
	}
	const scope = { jinxes: [...own.values()] };
	for (const jinx of own.values()) {
		// The script's own jinx replaces TPI's: its own rules, else its wording.
		out.push({ ...jinx, source: 'script', exclusive: jinxIsExclusive(jinx, characters, scope) });
	}
	return out;
}

export interface JinxSetupWarning {
	characters: readonly [CharacterId, CharacterId];
	message: string;
	jinx: ScriptJinx;
}

/**
 * Setup warnings for exclusive jinxes where both characters were chosen. `names` turns ids
 * into display names.
 */
export function jinxSetupWarnings(
	jinxes: readonly ScriptJinx[],
	inPlay: Iterable<CharacterId>,
	names: (id: CharacterId) => string = (id) => id
): JinxSetupWarning[] {
	const chosen = new Set(inPlay);
	return jinxes
		.filter((j) => j.exclusive && chosen.has(j.characters[0]) && chosen.has(j.characters[1]))
		.map((jinx) => {
			const [a, b] = jinx.characters;
			return {
				characters: jinx.characters,
				jinx,
				message: `${names(a)} and ${names(b)} are jinxed: only one of them can be in play.`
			};
		});
}

/** The jinxes that involve characters actually in play (for the grimoire, not the sheet). */
export function activeJinxes(
	jinxes: readonly ScriptJinx[],
	inPlay: Iterable<CharacterId>
): ScriptJinx[] {
	const chosen = new Set(inPlay);
	return jinxes.filter((j) => chosen.has(j.characters[0]) && chosen.has(j.characters[1]));
}

/**
 * The jinxes to show on one character's night step or day row: those involving it whose both
 * characters are in play, in the order given. A jinx counts while both are in play, so the
 * Storyteller sees it where either character is run (https://wiki.bloodontheclocktower.com/Djinn).
 */
export function jinxesOnStep<J extends Jinx>(
	jinxes: readonly J[],
	characterId: CharacterId,
	inPlay: Iterable<CharacterId>
): J[] {
	const chosen = new Set(inPlay);
	if (!chosen.has(characterId)) return [];
	return jinxes.filter(
		({ characters: [a, b] }) =>
			(a === characterId && chosen.has(b)) || (b === characterId && chosen.has(a))
	);
}

/**
 * The character in play that a jinx says can't be in play alongside `characterId`, were
 * `seatId` to become it (`exclusive`: the Pit-Hag cannot create a Heretic,
 * https://wiki.bloodontheclocktower.com/Djinn): a true character on another seat, or a rule
 * character. Undefined when nothing forbids it. Only one of an exclusive pair may be in play,
 * so this holds wherever the change comes from; the Storyteller is warned, never stopped.
 */
export function jinxForbidsBecoming(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): CharacterId | undefined {
	const inPlay = new Set<CharacterId>(game.ruleCharacters);
	for (const id of game.seating) {
		if (id === seatId) continue;
		const truly = trueCharacter(game, id, characters);
		if (truly !== undefined) inPlay.add(truly);
	}
	return [...inPlay].find(
		(other) =>
			other !== characterId &&
			rulesForJinx(game.script, characterId, other, characters)?.exclusive === true
	);
}

/**
 * The other players who become `created` too, now that `changer`'s `changesCharacter` made
 * one player it (`allEvilBecome`: when the Engineer, the Hatter or the Summoner creates Legion,
 * every evil player becomes Legion, https://wiki.bloodontheclocktower.com/Legion#Related_Jinxes):
 * every evil player, alive or dead, who isn't it yet. Empty when no jinx says so.
 */
export function allEvilBecoming(
	game: Game,
	changer: CharacterId,
	created: CharacterId,
	characters: CharacterLookup
): SeatId[] {
	const effect = ownJinxRules(game, changer, created, characters)?.allEvilBecome;
	if (!effect || !jinxApplies(game, changer, created, effect, characters)) return [];
	return game.seating.filter(
		(id) => alignmentOf(game, id) === 'evil' && trueCharacter(game, id, characters) !== created
	);
}

/**
 * The character whose ability the Storyteller gains now that `by`'s `changesCharacter` changes
 * `seatId` (`storytellerHas: 'removed'`: when the Engineer removes the living Summoner from
 * play, the Storyteller has the Summoner ability,
 * https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes): the living player's true
 * character, asked before the change. Undefined when no jinx says so.
 */
export function storytellerGains(
	game: Game,
	seatId: SeatId,
	by: CharacterId,
	characters: CharacterLookup
): CharacterId | undefined {
	if (game.seats[seatId]?.dead) return undefined;
	const own = trueCharacter(game, seatId, characters);
	if (own === undefined) return undefined;
	const effect = ownJinxRules(game, own, by, characters)?.storytellerHas;
	return effect?.once === 'removed' && jinxApplies(game, own, by, effect, characters)
		? own
		: undefined;
}

/**
 * The partners whose jinx with `changer` makes deaths tonight arbitrary should its
 * `changesCharacter` make a second living Demon (`arbitraryDeaths`: the Summoner with the
 * Hatter, the Kazali and the Pit-Hag,
 * https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes).
 */
export function arbitraryDeathPartners(
	game: Pick<Game, 'script'>,
	changer: CharacterId,
	characters?: RulesLookup
): CharacterId[] {
	return ownJinxEffects(game, changer, 'arbitraryDeaths', characters).map((j) => j.partner);
}

/**
 * Whether deaths tonight are arbitrary now that `changer`'s `changesCharacter` made `seatId` a
 * Demon (`arbitraryDeaths`): they are alive, and so is another player who is a Demon.
 */
export function arbitraryDeathsTonight(
	game: Game,
	changer: CharacterId,
	seatId: SeatId,
	characters: CharacterLookup
): boolean {
	if (arbitraryDeathPartners(game, changer, characters).length === 0) return false;
	const livingDemon = (id: SeatId) =>
		!game.seats[id]?.dead && typeOf(game, id, characters) === 'demon';
	return livingDemon(seatId) && game.seating.some((id) => id !== seatId && livingDemon(id));
}

/** What a `neighbourBecomes` jinx asks of the player just made the partner. */
export interface NeighbourBecoming {
	/** The type a neighbour must be, and the other neighbour becomes. */
	type: CharacterType;
	/** Whether a neighbour already is of `type`. */
	fits: boolean;
	/** The other neighbour, who becomes an evil one of `type`; none when both already are. */
	becomes?: SeatId;
}

/**
 * What a jinx asks of `seatId`'s neighbours when `changer`'s `changesCharacter` makes them
 * `created` (`neighbourBecomes`: a summoned Lord of Typhon must neighbour a Minion, and their
 * other neighbour becomes an evil Minion,
 * https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes). Neighbours are the nearest
 * living players. Undefined when no jinx says so.
 */
export function neighbourBecoming(
	game: Game,
	changer: CharacterId,
	created: CharacterId,
	seatId: SeatId,
	characters: CharacterLookup
): NeighbourBecoming | undefined {
	const effect = ownJinxRules(game, changer, created, characters)?.neighbourBecomes;
	if (!effect || !jinxApplies(game, changer, created, effect, characters)) return undefined;
	const type = effect.type;
	const near = aliveNeighbours(game, seatId).filter((id) => id !== seatId);
	const of = near.filter((id) => typeOf(game, id, characters) === type);
	const fits = of.length > 0;
	const becomes = fits ? near.find((id) => !of.includes(id)) : undefined;
	return { type, fits, ...(becomes !== undefined ? { becomes } : {}) };
}

/**
 * The partners whose jinx means the Storyteller, not `changer`'s player, chooses which player
 * its `changesCharacter` changes tonight (`storytellerChooses`, whatever it makes, while its
 * `when` holds: with `partner-alive`, the Summoner chooses which Demon but not which player
 * while the Poppy Grower lives, https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes).
 */
export function storytellerPicksNow(
	game: Game,
	changer: CharacterId,
	characters: CharacterLookup
): CharacterId[] {
	return ownJinxEffects(
		game,
		changer,
		'storytellerChooses',
		characters,
		(e) => e.what === 'player' && e.creating === undefined
	).map((j) => j.partner);
}

/**
 * The tokens on which `changer`'s `changesCharacter` may create a jinxed partner early, each
 * with that partner (`earlierToken`: the Summoner may summon a Pukka on its Night 2,
 * https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes).
 */
export function earlierTokens(
	game: Pick<Game, 'script'>,
	changer: CharacterId,
	characters?: RulesLookup
): { partner: CharacterId; token: ReminderLabel }[] {
	return ownJinxEffects(game, changer, 'earlierToken', characters).map(({ partner, effect }) => ({
		partner,
		token: effect.token
	}));
}
