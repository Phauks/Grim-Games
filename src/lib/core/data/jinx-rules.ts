/**
 * The `jinxes` part of a character's rules block: what each jinx with another character
 * changes in the app, keyed by the other character's id (the jinxed partner). A jinx is in
 * effect for a game whose script holds both characters: that is when the Djinn joins the
 * script and its jinxes are explained to everyone, including those about characters not in
 * play (https://wiki.bloodontheclocktower.com/Djinn). The jinx's wording stays TPI's
 * (`jinxes.json`) or the script's own; this block only says what the app does about it. It
 * names a behaviour, never a character in code:
 * - `exclusive`: only one of the two may be in play, so choosing both warns at setup (the
 *   Heretic's six, https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes);
 * - `notGiven`: this character's `givesAbility` never offers the partner's ability (the
 *   Boffin's Demon cannot have the Drunk, Heretic, Ogre or Politician ability,
 *   https://wiki.bloodontheclocktower.com/Boffin#Related_Jinxes);
 * - `givenInstead`: when this character's `givesAbility` would give the partner's ability to
 *   the Storyteller, something else happens instead (the Plague Doctor's Minions,
 *   https://wiki.bloodontheclocktower.com/Plague_Doctor#Related_Jinxes): `a-minion`, a Minion
 *   holds it and learns this; `a-player-becomes`, a player becomes the partner;
 *   `demon-neighbour-becomes`, one of the Demon's good neighbours becomes it; `outsiders`, up
 *   to two players become Outsiders;
 * - `noTurnGood`: a player this character gives the partner's ability to (`givesAbility`), or
 *   turns from evil into the partner (`changesCharacter`), can't turn good by that ability, so
 *   the app offers no change to good and warns on one made by hand (the Boffin's Cult Leader
 *   and Goon, the Pit-Hag's Cult Leader, Goon, Ogre and Politician);
 * - `spareToken`: with a spare token, this character may give or create the partner even
 *   while it is in play, so its picker offers it (the Boffin's and the Pit-Hag's Village
 *   Idiot);
 * - `storytellerPicksPlayer`: when this character creates the partner, the Storyteller picks
 *   which player it is, and its step says so (the Pit-Hag's Damsel);
 * - `alsoBecomes`: when this character's `changesCharacter` would make a player the partner,
 *   who is never dealt, they also choose a character of this type and become that (the
 *   Hatter's Demon who chooses Lil' Monsta also chooses a Minion,
 *   https://wiki.bloodontheclocktower.com/Hatter#Related_Jinxes);
 * - `carrierType`: while the partner's player is alive, only a player of this type carries
 *   this character's `carrierIsDemon` token, so it fits no one else (the Magician's and the
 *   Poppy Grower's Lil' Monsta goes to a Minion,
 *   https://wiki.bloodontheclocktower.com/Lil%27_Monsta#Related_Jinxes);
 * - `keptByPartner`: once the partner's `becomes` token marks its player, that player carries
 *   this character's `carrierIsDemon` token for the rest of the game, so it fits no one else
 *   (the Scarlet Woman babysits Lil' Monsta);
 * - `diesWhenExecuted`: while this character's player carries the partner's token named here,
 *   its own `protects` doesn't save them from execution (the Psychopath and the Vizier
 *   babysitting Lil' Monsta);
 * - `registersTo`: this character's player may also register as these `alignments` and
 *   `types` to the partner's ability, or with `always` registers only as them (each listed
 *   part replaces the usual ones), whatever its own ability's state: the Politician and the
 *   Zealot as evil to Legion and the Vizier, the Recluse as the Demon to the Sage and as evil
 *   to the Ogre, the Spy always as evil to the Ogre, the Summoner always as the Demon to the
 *   Clockmaker (each page's Related Jinxes);
 * - `impairsPartner`: while this character is in play (alive or dead), the partner's player
 *   is `poisoned` (or `drunk`, or has `no-ability`), whatever this character's ability's
 *   state: the Spy and the Widow poison the Damsel
 *   (https://wiki.bloodontheclocktower.com/Damsel#Related_Jinxes), the Vizier leaves the
 *   Magician with no ability (https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes);
 * - `noKill`: with `token`, no kill from this character tonight while the partner's own
 *   `stopsWaking` or `stopsKilling` token is on its player (the Exorcist's Chosen on the
 *   Yaggababble, the Princess's Doesn't Kill on the Al-Hadikhia); with `executed-partner`,
 *   no Demon kills tonight when this character's player nominated the partner's player today
 *   and they died by execution (the Cannibal and the Princess);
 * - `noGrimoire`: this character's player does not see the Grimoire while the partner's
 *   ability works (the Spy and the Widow while the Poppy Grower has its ability);
 * - `grimoireHides`: when this character's player sees the Grimoire while the partner is in
 *   play, these tokens come off it first: `partner`, the partner's, and every token of each
 *   listed character type (the Magician's and the Demon's, for the Spy and the Widow);
 * - `endsGame`: a way the game ends with the partner, worked out in `rules/jinx-ends.ts` (the
 *   Leviathan's and Riot's, each page's Related Jinxes): `nominated-marked-executed`, this
 *   character's player nominates the player with the partner's `token` (or, with none, the
 *   partner's own player) and they are executed, so `winner` wins (the Exorcist's Chosen,
 *   the Innkeeper's and Monk's Safe, the Soldier); `marked-executed`, while this character is
 *   in play, the player with the partner's `token` dies by execution, so `winner` wins (the
 *   Grandmother's Grandchild); `day-without-execution`, this character's player and the
 *   partner's are alive when day `day` ends with no execution that day, so `winner` wins in
 *   place of this character's own end that day (the Mayor); `partner-stops`, the partner's
 *   player chooses to stop this character's ability (their day use, recorded with `stops`),
 *   so `winner` wins if exactly `alive` players of this character are alive, otherwise the
 *   other team (the Mayor stopping the riot);
 * - `storytellerVote`: while this character's nominees nominate straight away
 *   (`nomineesNominate`), a nominated Storyteller is voted on instead: the Storyteller judges
 *   whether they are about to die, and executes them (the partner's `storyteller-executed`
 *   end) or the nominator nominates again (the Riot with the Atheist);
 * - `deadAtLeast`: while the partner is in play, this character's `wakesWhen` dead count is
 *   met once this many players are dead (the King with the Leviathan or Riot,
 *   https://wiki.bloodontheclocktower.com/King#Related_Jinxes);
 * - `notCreatedAfterDay`: once day `n` is over, this character's `changesCharacter` doesn't
 *   offer the partner (the Pit-Hag's and the Hatter's Leviathan,
 *   https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes);
 * - `nightChoice`: each night but the first, this character's player chooses an alive player
 *   not chosen on an earlier night (`who: "good"`, a good one), and a chosen partner either
 *   uses its ability without dying (`partner: "acts"`) or dies and gains it (`"dies"`), worked
 *   out in `rules/jinx-choices.ts` (the Leviathan's and Riot's Banshee, Farmer, Ravenkeeper
 *   and Sage, https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes);
 * - `withPartnerAbility`: what setup needs when this character's player has the partner's
 *   ability (`gainsAbilityOf`): `partner-setup`, the partner's own setup change applies as if
 *   it were in play (the Alchemist-Summoner, [No Demon]; the Philosopher who gains the Bounty
 *   Hunter's, a Townsfolk might turn evil, a `partner-setup` night alert at its step);
 *   `partner-in-play`, the real partner is in play as well, and this player has no ability
 *   (the Alchemist-Marionette, -Spy, -Widow and -Wraith,
 *   https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes); `no-ability`, this player
 *   has no ability (the Alchemist-Mastermind); `both-drunk`, the real partner is in play as
 *   well, and while neither player is otherwise drunk or poisoned, both are drunk (the
 *   Alchemist-Organ Grinder). The player's ability is taken in `abilityState`;
 * - `learnsGained`: the night after this character's `gainedFrom` gives its player the
 *   partner's ability (the partner's player died by execution today), they learn something
 *   they otherwise wouldn't: `ability`, that they have the partner's ability (the Cannibal's
 *   Butler and Zealot); `answer`, what the partner's own player would have learned tonight
 *   (the Cannibal's Juggler, https://wiki.bloodontheclocktower.com/Cannibal#Related_Jinxes);
 * - `trueInfo`: this character's `falseInfo` doesn't make the partner's information false
 *   (the Vortox's Banshee, https://wiki.bloodontheclocktower.com/Vortox#Related_Jinxes);
 * - `notDeclared`: the Storyteller doesn't declare that this character is in play, so its
 *   after-Dawn step, its line in the day's Announcements and its `announcement` day
 *   reminders are left out (the Vizier with the Alsaahir and the Investigator,
 *   https://wiki.bloodontheclocktower.com/Vizier#Related_Jinxes);
 * - `keepsProtection`: when the partner's ability takes this character's ability away, its
 *   own `protects` still holds, and its player learns this (a `keeps-protection` night alert
 *   at the partner's step): the Vizier with the Courtier and the Preacher still can't die by
 *   day;
 * - `wakesWithPartner`: this character's player wakes at the partner's step and learns whom
 *   the partner chooses (a `wakes-with` night alert): the Vizier with the Fearmonger;
 * - `noExecuteNow`: this character's `executionOutcome.executeNow` doesn't apply to this
 *   player (an `OutcomeProblem` `jinxed`, warned, never locked): `who: "partner"`, the
 *   partner's own player (the Magician is immune to the Vizier); `who: "marked"` with
 *   `token`, the player with that partner's token (the Fearmonger's Fear).
 * - `allEvilBecome`: when this character's `changesCharacter` creates the partner, every other
 *   evil player becomes it too (the Engineer's, the Hatter's and the Summoner's Legion,
 *   https://wiki.bloodontheclocktower.com/Legion#Related_Jinxes);
 * - `learnsNoAbility`: on the first night, this character's player learns that the partner
 *   took their ability (`impairsPartner` on the partner's side), a `learns-no-ability` night
 *   alert at this character's own step (the Engineer with Legion);
 * - `partnerKeepsAbility`: this character's `impairs` tokens never reach the partner's
 *   players, and while one would have, this character's player might learn the partner is in
 *   play (a `might-learn` night alert at this character's step and the partner's): the
 *   Minstrel's and the Preacher's Legion;
 * - `demonLearnsGood`: while the partner is in play, at Demon info its players wake in
 *   separate groups and each learns which players are good, never this character's player,
 *   who is not shown as a Minion either (the Magician with Legion);
 * - `storytellerHas`: the Storyteller has this character's ability: `no-ability`, while its
 *   living player has no ability (drunk, poisoned or without one), a `storyteller-has` night
 *   alert at its step (the Summoner with the Courtier and the Preacher); `removed`, once the
 *   partner's `changesCharacter` changes its living player into another character, the
 *   Storyteller gains it (`storytellerAbilities`, the Summoner with the Engineer,
 *   https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes);
 * - `arbitraryDeaths`: when this character's `changesCharacter` makes a player a Demon while
 *   another living player is a Demon, deaths tonight are arbitrary, and its step says so (the
 *   Summoner with the Hatter, the Kazali and the Pit-Hag);
 * - `neighbourBecomes`: when this character's `changesCharacter` makes a player the partner,
 *   that player must neighbour a player of this type, and their other neighbour becomes an
 *   evil one of it (the Summoner's Lord of Typhon, a Minion);
 * - `storytellerPicksWhileAlive`: while the partner's player is alive, this character's player
 *   chooses only which character its `changesCharacter` makes, and the Storyteller chooses the
 *   player (the Summoner with the Poppy Grower alive on the 3rd night);
 * - `earlierToken`: this character's `changesCharacter` may also create the partner, and only
 *   the partner, while its player carries this token instead of its usual `token` (the
 *   Summoner's Pukka on the 2nd night);
 * - `guessesPartner`: after each execution, this character's living player (with
 *   `withPartnerAbility`, only while they have the partner's ability) may publicly guess a
 *   living player as the partner; if right, the Demon must choose the partner's player
 *   tonight, a `guessed` night alert at each Demon's step (the Alchemist-Spy, -Widow and
 *   -Wraith, the Magician with the Wraith);
 * - `notShownGiven`: with the partner's ability, this character's player isn't shown the
 *   ability the partner's `givesAbility` gave (the Alchemist-Boffin doesn't learn the Demon's
 *   good ability): a `not-shown-given` night alert at the partner's step;
 * - `notSecondDemon`: this character's `becomes` never makes a second Demon while the
 *   partner's player lives: the partner's Demon passing on by its own death (`death-passes`)
 *   doesn't let this player become the Demon too, and its `becomes` token fits no player
 *   while a living player is the partner, so a player carrying it becomes this character
 *   again (the Scarlet Woman with the Fang Gu and the Al-Hadikhia);
 * - `keepsAfterPartner`: once the partner's `keepsAbility` token keeps this character's dead
 *   player's ability, they keep it after the partner's player dies (the Mastermind with the
 *   Vigormortis);
 * - `survivesCarrierExecuted`: while the partner's player is alive, the carrier of this
 *   character's `gameEnd.aliveWhileDead.whileCarrierAlive` token dying by execution doesn't
 *   kill this character's player: they live on with no ability (the Lleech with the
 *   Mastermind);
 * - `killsMarked`: this character's kill (`deathCause.victim`) also kills the player carrying
 *   the partner's reminder named here (the Slayer shooting the Lleech's host, "Poisoned");
 * - `madAsPartner`: this character's `madness` may be about the partner, though the partner
 *   is not good: a `may-mad-as` night alert at its step (the Cerenovus with the Goblin);
 * - `hidesPartnerSeat`: while this character's player is alive, at Demon info the Demon is
 *   not told which of its neighbours is the partner's player (`DemonInfo.neighbourHidden`:
 *   the Magician with the Marionette);
 * - `thinksPartnerSetup`: while this character's player thinks they are the partner (their
 *   seat shows the partner's token), the partner's own setup change applies as if it were in
 *   play (the Marionette who thinks they are the Balloonist or the Huntsman);
 * - `uncountedVote`: while the partner's working `voting.secret` has votes cast with eyes
 *   closed, this character's player may raise their hand without their `voter.onlyWith`
 *   player, but the vote counts only if that player voted too (the Butler with the Organ
 *   Grinder): no warning, and the vote hint says so;
 * - `gainedEndWinner`: with the partner's ability, the partner's `gameEnd` `dead-without-demon`
 *   end applies to this character's player as soon as they die, with this winner (the
 *   Alchemist-Summoner who dies before summoning: evil wins);
 * - `picksCharacterOnly`: with the partner's ability (`abilityHolders`, not their own), this
 *   character's player chooses only which character the partner's `changesCharacter` makes,
 *   and the Storyteller chooses the player (the Alchemist-Summoner chooses which Demon but not
 *   which player): a note on the step;
 * - `noBluffs`: with the partner's ability (not their own), this character's player doesn't
 *   get the bluffs the partner's `evilInfo` notes say it gets, so those notes are left out of
 *   the evil info steps (the Alchemist-Summoner);
 * - `partnerChoosesEnd`: when the partner's Demon dies by execution while this character's
 *   player is alive, its `extra-day` is a night instead: the partner's player chooses 3 good
 *   players tonight, and if all 3 choose to live evil wins, otherwise good wins (the Mastermind
 *   with the Al-Hadikhia). The game end is a `jinx-night` hold; the Storyteller ends the game.
 * - `abnormalCounts`: this character's `abnormal-abilities` count also counts the partner's
 *   player when the partner's own ability made it work abnormally, which otherwise is no other
 *   character's doing (https://wiki.bloodontheclocktower.com/Mathematician#Related_Jinxes):
 *   `own-ability`, info recorded as abnormal because of the partner's own ability (the Drunk's
 *   false info, the Marionette's); `demon-choice`, the partner's `choosesLikeDemon` reminder is
 *   on none of the players the Demon killed tonight (the Lunatic attacking someone else).
 *
 * Either character's file may hold the block. `registersTo`, `impairsPartner`, `noKill`,
 * `noGrimoire`, `grimoireHides`, `endsGame`, `storytellerVote`, `deadAtLeast`,
 * `notCreatedAfterDay`, `nightChoice`, `withPartnerAbility`, `learnsGained`, `trueInfo`,
 * `notDeclared`, `keepsProtection`, `wakesWithPartner`, `noExecuteNow`, `alsoBecomes`,
 * `carrierType`, `keptByPartner`, `diesWhenExecuted`, `allEvilBecome`, `learnsNoAbility`,
 * `partnerKeepsAbility`, `demonLearnsGood`, `storytellerHas`, `arbitraryDeaths`,
 * `neighbourBecomes`, `storytellerPicksWhileAlive`, `earlierToken`, `guessesPartner`,
 * `notShownGiven`, `notSecondDemon`, `keepsAfterPartner`, `survivesCarrierExecuted`,
 * `killsMarked`, `madAsPartner`, `hidesPartnerSeat`, `thinksPartnerSetup`, `uncountedVote`,
 * `gainedEndWinner`, `picksCharacterOnly`, `noBluffs`, `partnerChoosesEnd` and
 * `abnormalCounts` say what
 * this character does, or how it is treated, with the partner, so they are read from this
 * character's side only (`ownJinxRules`); the others are read from both sides
 * (`rules/jinxes.ts`). By convention a block goes in the file of the
 * character whose behaviour changes, and an `exclusive` one in the first of TPI's pair.
 */
import {
	ALIGNMENTS,
	CHARACTER_TYPES,
	type Alignment,
	type CharacterId,
	type CharacterType,
	type ReminderLabel
} from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readNumber,
	readString,
	readStringArray,
	type Issues
} from './validate.ts';

/** A `registersTo` entry: how this character's player may register to the partner. */
export interface RegistersTo {
	alignments?: readonly Alignment[];
	types?: readonly CharacterType[];
	always?: true;
}

export const NO_KILL_TRIGGERS = ['token', 'executed-partner'] as const;
export type NoKillTrigger = (typeof NO_KILL_TRIGGERS)[number];

/** A `grimoireHides` entry: the partner's token, or every token of a character type. */
export type GrimoireHidden = 'partner' | CharacterType;
const GRIMOIRE_HIDDEN: readonly GrimoireHidden[] = ['partner', ...CHARACTER_TYPES];

export const JINX_END_KINDS = [
	'nominated-marked-executed',
	'marked-executed',
	'day-without-execution',
	'partner-stops'
] as const;
export type JinxEndKind = (typeof JINX_END_KINDS)[number];

/** An `endsGame` entry: how the game ends with the partner, and who wins. */
export interface JinxEnd {
	kind: JinxEndKind;
	winner: Alignment;
	/** One of the partner's reminders, on the player it is about. */
	token?: ReminderLabel;
	/** The day whose end it is checked at (`day-without-execution`). */
	day?: number;
	/** How many of this character's players alive give `winner` the game (`partner-stops`). */
	alive?: number;
}

export const NIGHT_CHOICE_WHO = ['good', 'any'] as const;
export const NIGHT_CHOICE_PARTNER = ['acts', 'dies'] as const;

/** A `nightChoice` entry: whom this character chooses each night, and what a chosen partner does. */
export interface NightChoice {
	/** `good`: only an alive good player; `any`: any alive player. */
	who: (typeof NIGHT_CHOICE_WHO)[number];
	/** `acts`: the partner uses its ability but does not die; `dies`: it dies and gains it. */
	partner: (typeof NIGHT_CHOICE_PARTNER)[number];
}

export const NO_EXECUTE_NOW_WHO = ['partner', 'marked'] as const;

/** A `noExecuteNow` entry: the player this character's execute-now doesn't reach. */
export interface NoExecuteNow {
	/** `partner`: the partner's own player; `marked`: the player with the partner's `token`. */
	who: (typeof NO_EXECUTE_NOW_WHO)[number];
	token?: ReminderLabel;
}

export const IMPAIRS_PARTNER = ['poisoned', 'drunk', 'no-ability'] as const;

export interface JinxRules {
	exclusive?: true;
	notGiven?: true;
	givenInstead?: GivenInstead;
	noTurnGood?: true;
	spareToken?: true;
	storytellerPicksPlayer?: true;
	alsoBecomes?: CharacterType;
	carrierType?: CharacterType;
	keptByPartner?: true;
	diesWhenExecuted?: ReminderLabel;
	registersTo?: RegistersTo;
	impairsPartner?: (typeof IMPAIRS_PARTNER)[number];
	noKill?: NoKillTrigger;
	noGrimoire?: true;
	grimoireHides?: readonly GrimoireHidden[];
	endsGame?: JinxEnd;
	storytellerVote?: true;
	deadAtLeast?: number;
	notCreatedAfterDay?: number;
	nightChoice?: NightChoice;
	withPartnerAbility?: WithPartnerAbility;
	notDeclared?: true;
	keepsProtection?: true;
	wakesWithPartner?: true;
	noExecuteNow?: NoExecuteNow;
	learnsGained?: LearnsGained;
	trueInfo?: true;
	allEvilBecome?: true;
	learnsNoAbility?: true;
	partnerKeepsAbility?: true;
	demonLearnsGood?: true;
	storytellerHas?: StorytellerHas;
	arbitraryDeaths?: true;
	neighbourBecomes?: CharacterType;
	storytellerPicksWhileAlive?: true;
	earlierToken?: ReminderLabel;
	guessesPartner?: true;
	notShownGiven?: true;
	notSecondDemon?: true;
	keepsAfterPartner?: true;
	survivesCarrierExecuted?: true;
	killsMarked?: ReminderLabel;
	madAsPartner?: true;
	hidesPartnerSeat?: true;
	thinksPartnerSetup?: true;
	uncountedVote?: true;
	gainedEndWinner?: Alignment;
	picksCharacterOnly?: true;
	noBluffs?: true;
	partnerChoosesEnd?: true;
	abnormalCounts?: AbnormalCounts;
}

export const ABNORMAL_COUNTS = ['own-ability', 'demon-choice'] as const;
export type AbnormalCounts = (typeof ABNORMAL_COUNTS)[number];

export const STORYTELLER_HAS = ['no-ability', 'removed'] as const;
export type StorytellerHas = (typeof STORYTELLER_HAS)[number];

export const LEARNS_GAINED = ['ability', 'answer'] as const;
export type LearnsGained = (typeof LEARNS_GAINED)[number];

export const WITH_PARTNER_ABILITY = [
	'partner-setup',
	'partner-in-play',
	'no-ability',
	'both-drunk'
] as const;
export type WithPartnerAbility = (typeof WITH_PARTNER_ABILITY)[number];

export const GIVEN_INSTEAD = [
	'a-minion',
	'a-player-becomes',
	'demon-neighbour-becomes',
	'outsiders'
] as const;
export type GivenInstead = (typeof GIVEN_INSTEAD)[number];

export const JINX_RULE_KEYS = [
	'exclusive',
	'notGiven',
	'givenInstead',
	'noTurnGood',
	'spareToken',
	'storytellerPicksPlayer',
	'alsoBecomes',
	'carrierType',
	'keptByPartner',
	'diesWhenExecuted',
	'registersTo',
	'impairsPartner',
	'noKill',
	'noGrimoire',
	'grimoireHides',
	'endsGame',
	'storytellerVote',
	'deadAtLeast',
	'notCreatedAfterDay',
	'nightChoice',
	'withPartnerAbility',
	'notDeclared',
	'keepsProtection',
	'wakesWithPartner',
	'noExecuteNow',
	'learnsGained',
	'trueInfo',
	'allEvilBecome',
	'learnsNoAbility',
	'partnerKeepsAbility',
	'demonLearnsGood',
	'storytellerHas',
	'arbitraryDeaths',
	'neighbourBecomes',
	'storytellerPicksWhileAlive',
	'earlierToken',
	'guessesPartner',
	'notShownGiven',
	'notSecondDemon',
	'keepsAfterPartner',
	'survivesCarrierExecuted',
	'killsMarked',
	'madAsPartner',
	'hidesPartnerSeat',
	'thinksPartnerSetup',
	'uncountedVote',
	'gainedEndWinner',
	'picksCharacterOnly',
	'noBluffs',
	'partnerChoosesEnd',
	'abnormalCounts'
] as const;

/** A non-empty list of known values, or undefined (with an issue) when it is not one. */
function readEnumList<T extends string>(
	raw: Record<string, unknown>,
	key: string,
	values: readonly T[],
	path: string,
	issues: Issues
): T[] | undefined {
	const list = readStringArray(raw, key, path, issues);
	if (!list) return undefined;
	const bad = list.filter((v) => !(values as readonly string[]).includes(v));
	for (const v of bad) issues.add(`${path}.${key}`, `unknown value ${JSON.stringify(v)}`);
	if (bad.length > 0) return undefined;
	if (list.length === 0) {
		issues.add(`${path}.${key}`, 'empty');
		return undefined;
	}
	return list as T[];
}

function readRegistersTo(raw: unknown, path: string, issues: Issues): RegistersTo | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['alignments', 'types', 'always'], path, issues);
	const out: RegistersTo = {};
	const alignments = readEnumList(raw, 'alignments', ALIGNMENTS, path, issues);
	if (alignments) out.alignments = alignments;
	const types = readEnumList(raw, 'types', CHARACTER_TYPES, path, issues);
	if (types) out.types = types;
	if (readBoolean(raw, 'always', path, issues)) out.always = true;
	if (!out.alignments && !out.types) {
		issues.add(path, 'needs alignments or types');
		return undefined;
	}
	return out;
}

function readJinxEnd(raw: unknown, path: string, issues: Issues): JinxEnd | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const kind = readEnum(raw, 'kind', JINX_END_KINDS, path, issues, true);
	if (!kind) return undefined;
	const keys = {
		'nominated-marked-executed': ['token'],
		'marked-executed': ['token'],
		'day-without-execution': ['day'],
		'partner-stops': ['alive']
	}[kind];
	checkKeys(raw, ['kind', 'winner', ...keys], path, issues);
	const winner = readEnum(raw, 'winner', ALIGNMENTS, path, issues, true);
	if (!winner) return undefined;
	const out: JinxEnd = { kind, winner };
	const token = readString(raw, 'token', path, issues, kind === 'marked-executed');
	if (token !== undefined) out.token = token;
	if (kind === 'marked-executed' && token === undefined) return undefined;
	if (kind === 'day-without-execution') {
		const day = readPositive(raw, 'day', path, issues);
		if (day === undefined) return undefined;
		out.day = day;
	}
	if (kind === 'partner-stops') {
		const alive = readPositive(raw, 'alive', path, issues);
		if (alive === undefined) return undefined;
		out.alive = alive;
	}
	return out;
}

function readNightChoice(raw: unknown, path: string, issues: Issues): NightChoice | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['who', 'partner'], path, issues);
	const who = readEnum(raw, 'who', NIGHT_CHOICE_WHO, path, issues, true);
	const partner = readEnum(raw, 'partner', NIGHT_CHOICE_PARTNER, path, issues, true);
	return who && partner ? { who, partner } : undefined;
}

function readNoExecuteNow(raw: unknown, path: string, issues: Issues): NoExecuteNow | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['who', 'token'], path, issues);
	const who = readEnum(raw, 'who', NO_EXECUTE_NOW_WHO, path, issues, true);
	const token = readString(raw, 'token', path, issues, who === 'marked');
	if (!who || (who === 'marked' && token === undefined)) return undefined;
	return who === 'marked' ? { who, token } : { who };
}

/** A whole number of 1 or more, with an issue when it is given but isn't one. */
function readPositive(
	raw: Record<string, unknown>,
	key: string,
	path: string,
	issues: Issues
): number | undefined {
	const value = readNumber(raw, key, path, issues);
	if (raw[key] === undefined) {
		issues.add(`${path}.${key}`, 'missing');
		return undefined;
	}
	if (value === undefined) return undefined;
	if (!Number.isInteger(value) || value < 1) {
		issues.add(`${path}.${key}`, 'expected a whole number of 1 or more');
		return undefined;
	}
	return value;
}

/** Reads a `jinxes` block: one entry per jinxed partner, each saying at least one thing. */
export function readJinxRules(
	raw: unknown,
	path: string,
	issues: Issues
): Readonly<Record<CharacterId, JinxRules>> | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const out: Record<CharacterId, JinxRules> = {};
	for (const [partner, entry] of Object.entries(raw)) {
		const at = `${path}.${partner}`;
		if (!isObject(entry)) {
			issues.add(at, `expected object, got ${describe(entry)}`);
			continue;
		}
		checkKeys(entry, JINX_RULE_KEYS, at, issues);
		const rules: JinxRules = {};
		if (readBoolean(entry, 'exclusive', at, issues)) rules.exclusive = true;
		if (readBoolean(entry, 'notGiven', at, issues)) rules.notGiven = true;
		const instead = readEnum(entry, 'givenInstead', GIVEN_INSTEAD, at, issues, false);
		if (instead) rules.givenInstead = instead;
		if (readBoolean(entry, 'noTurnGood', at, issues)) rules.noTurnGood = true;
		if (readBoolean(entry, 'spareToken', at, issues)) rules.spareToken = true;
		if (readBoolean(entry, 'storytellerPicksPlayer', at, issues))
			rules.storytellerPicksPlayer = true;
		for (const key of ['alsoBecomes', 'carrierType', 'neighbourBecomes'] as const) {
			const type = readEnum(entry, key, CHARACTER_TYPES, at, issues, false);
			if (type) rules[key] = type;
		}
		if (readBoolean(entry, 'keptByPartner', at, issues)) rules.keptByPartner = true;
		const dies = readString(entry, 'diesWhenExecuted', at, issues, false);
		if (dies !== undefined) rules.diesWhenExecuted = dies;
		if (entry.registersTo !== undefined) {
			const registersTo = readRegistersTo(entry.registersTo, `${at}.registersTo`, issues);
			if (registersTo) rules.registersTo = registersTo;
		}
		const impairs = readEnum(entry, 'impairsPartner', IMPAIRS_PARTNER, at, issues, false);
		if (impairs) rules.impairsPartner = impairs;
		const noKill = readEnum(entry, 'noKill', NO_KILL_TRIGGERS, at, issues, false);
		if (noKill) rules.noKill = noKill;
		if (readBoolean(entry, 'noGrimoire', at, issues)) rules.noGrimoire = true;
		const hides = readEnumList(entry, 'grimoireHides', GRIMOIRE_HIDDEN, at, issues);
		if (hides) rules.grimoireHides = hides;
		if (entry.endsGame !== undefined) {
			const ends = readJinxEnd(entry.endsGame, `${at}.endsGame`, issues);
			if (ends) rules.endsGame = ends;
		}
		if (readBoolean(entry, 'storytellerVote', at, issues)) rules.storytellerVote = true;
		for (const key of ['deadAtLeast', 'notCreatedAfterDay'] as const) {
			if (entry[key] === undefined) continue;
			const n = readPositive(entry, key, at, issues);
			if (n !== undefined) rules[key] = n;
		}
		if (entry.nightChoice !== undefined) {
			const choice = readNightChoice(entry.nightChoice, `${at}.nightChoice`, issues);
			if (choice) rules.nightChoice = choice;
		}
		const withAbility = readEnum(
			entry,
			'withPartnerAbility',
			WITH_PARTNER_ABILITY,
			at,
			issues,
			false
		);
		if (withAbility) rules.withPartnerAbility = withAbility;
		for (const key of ['notDeclared', 'keepsProtection', 'wakesWithPartner'] as const)
			if (readBoolean(entry, key, at, issues)) rules[key] = true;
		if (entry.noExecuteNow !== undefined) {
			const no = readNoExecuteNow(entry.noExecuteNow, `${at}.noExecuteNow`, issues);
			if (no) rules.noExecuteNow = no;
		}
		const learns = readEnum(entry, 'learnsGained', LEARNS_GAINED, at, issues, false);
		if (learns) rules.learnsGained = learns;
		if (readBoolean(entry, 'trueInfo', at, issues)) rules.trueInfo = true;
		for (const key of [
			'allEvilBecome',
			'learnsNoAbility',
			'partnerKeepsAbility',
			'demonLearnsGood',
			'arbitraryDeaths',
			'storytellerPicksWhileAlive',
			'guessesPartner',
			'notShownGiven',
			'notSecondDemon',
			'keepsAfterPartner',
			'survivesCarrierExecuted',
			'madAsPartner',
			'hidesPartnerSeat',
			'thinksPartnerSetup',
			'uncountedVote',
			'picksCharacterOnly',
			'noBluffs',
			'partnerChoosesEnd'
		] as const)
			if (readBoolean(entry, key, at, issues)) rules[key] = true;
		const has = readEnum(entry, 'storytellerHas', STORYTELLER_HAS, at, issues, false);
		if (has) rules.storytellerHas = has;
		const earlier = readString(entry, 'earlierToken', at, issues, false);
		if (earlier !== undefined) rules.earlierToken = earlier;
		const marked = readString(entry, 'killsMarked', at, issues, false);
		if (marked !== undefined) rules.killsMarked = marked;
		const winner = readEnum(entry, 'gainedEndWinner', ALIGNMENTS, at, issues, false);
		if (winner) rules.gainedEndWinner = winner;
		const counts = readEnum(entry, 'abnormalCounts', ABNORMAL_COUNTS, at, issues, false);
		if (counts) rules.abnormalCounts = counts;
		if (Object.keys(rules).length === 0) {
			issues.add(at, 'a jinx entry needs at least one rule');
			continue;
		}
		out[partner] = rules;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}
