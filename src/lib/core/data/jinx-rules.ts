/**
 * The `jinxes` part of a character's rules block: what each jinx with another character
 * changes in the app, keyed by the other character's id (the jinxed partner). A jinx is in
 * effect for a game whose script holds both characters: that is when the Djinn joins the
 * script and its jinxes are explained to everyone, including those about characters not in
 * play (https://wiki.bloodontheclocktower.com/Djinn). The jinx's wording stays TPI's
 * (`jinxes.json`) or the script's own; this block only says what the app does about it.
 *
 * **Effects.** Each key is one effect, a general verb that names no character. Its value is
 * `true`, or an object of its parameters; a verb with one main parameter may be written as that
 * value alone (`"deadAtLeast": 1` is `{"dead": 1}`). Every effect object may also say:
 * - `who`: whose behaviour it changes, `self` (this file's character, the default) or
 *   `partner` (the key's character). So a block may live in either character's file, and one
 *   jinx's sentence lives in one place: "the Vizier's jinx leaves the Magician with no ability"
 *   is `impairs` with `who: "partner"` in the Vizier's file. `impairs` also takes `both`;
 * - `when`: conditions that must all hold for it to apply (`JINX_CONDITIONS` below). In a
 *   condition too, `self` is this file's character and `partner` the key's.
 * A jinx is read the same from either file (`rules/jinxes.ts`, `jinxRulesBetween`); both
 * files setting the same effect for the same character is an error (`jinxPartnerIssues`).
 *
 * Conditions (`when`), each about the game now:
 * - `self-alive`, `partner-alive`: a player of that character is alive (with a player in
 *   question, that player);
 * - `self-in-play`, `partner-in-play`: a player is that character, alive or dead;
 * - `has-partner-ability`: the effect is about a self player who has the partner's ability
 *   from their token (`gainsAbilityOf`, `gainedFrom`) or holds it, not their own; it applies to
 *   that player only. Its mirror, read from the partner's file, is `partner-has-this-ability`;
 * - `after-execution`: someone was executed today;
 * - `final-day`: 3 or fewer players are alive, not counting Travellers (the usual final day;
 *   the wiki leaves the exact day to the Storyteller);
 * - `{"day": n}`: today is day n (until the next dawn); `{"night": n}`: tonight is night n;
 *   `{"afterDay": n}`: day n is over (a change at night counts from the night after day n);
 * - `{"marked": label}`: the self player carries the partner's reminder `label`;
 *   `{"partnerMarked": label}`, the partner's player carries this character's.
 * Where a reader knows only the script (a picker, the bag), a condition about the board isn't
 * checked and the effect may apply.
 *
 * The verbs, each with an official example:
 * - `exclusive`: only one of the two may be in play, so choosing both warns at setup and a
 *   change that would put both in play warns (the Heretic's six,
 *   https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes). Always `true`: it is about
 *   the pair, so it takes no `who` or `when`;
 * - `cannotCreate`: the subject's ability named by `via` never makes the partner:
 *   `givesAbility` never gives its ability, `changesCharacter` never makes a player it (the
 *   Boffin's Drunk, Heretic, Ogre and Politician; with `{"afterDay": 5}`, the Pit-Hag's and the
 *   Hatter's Leviathan, https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes);
 * - `givenInstead`: when the subject's `givesAbility` would give the partner's ability to the
 *   Storyteller, `instead` happens: `a-minion`, a Minion holds it and learns this;
 *   `a-player-becomes`, a player becomes the partner; `demon-neighbour-becomes`, one of the
 *   Demon's good neighbours becomes it; `outsiders`, up to two players become Outsiders (the
 *   Plague Doctor's, https://wiki.bloodontheclocktower.com/Plague_Doctor#Related_Jinxes);
 * - `noTurnGood`: a player the subject gives the partner's ability to (`givesAbility`), or
 *   turns from evil into the partner (`changesCharacter`), can't turn good by that ability: no
 *   change to good is offered and one made by hand warns (the Boffin's and the Pit-Hag's Cult
 *   Leader and Goon);
 * - `spareToken`: with a spare token, the subject may give or create the partner even while
 *   it is in play, so its picker offers it (the Boffin's and the Pit-Hag's Village Idiot);
 * - `storytellerChooses`: when the subject's `changesCharacter` (its own, or the partner's
 *   with `has-partner-ability`) changes a player, the Storyteller chooses which `what:
 *   "player"`, and the subject's player only the character; with `creating: "partner"`, only
 *   when it makes the partner (the Pit-Hag's Damsel; with `partner-alive`, the Summoner while
 *   the Poppy Grower lives; with `has-partner-ability`, the Alchemist-Summoner);
 * - `alsoBecomes`: when the subject's `changesCharacter` would make a player the partner, who
 *   is never dealt, they also choose a character of `type` and become that (the Hatter's Lil'
 *   Monsta, https://wiki.bloodontheclocktower.com/Hatter#Related_Jinxes);
 * - `carriedBy`: who may carry the subject's `carrierIsDemon` token: only a player of `type`
 *   (with `partner-alive`, the Magician's and the Poppy Grower's Lil' Monsta goes to a
 *   Minion), or, once a player carries the partner's reminder `marked`, only that player (the
 *   Scarlet Woman babysits Lil' Monsta, https://wiki.bloodontheclocktower.com/Lil%27_Monsta);
 * - `diesWhenExecuted`: the subject's own `protects` doesn't save its player from execution
 *   (with `{"marked": "Is The Demon"}`, the Psychopath and the Vizier babysitting Lil' Monsta);
 * - `registersTo`: the subject's player may also register as these `alignments` and `types`
 *   to the partner's ability, or with `always` only as them, whatever its own ability's state
 *   (the Politician as evil to Legion, the Spy always as evil to the Ogre, each page's Related
 *   Jinxes);
 * - `impairs`: the subject's player is `kind` (`poisoned`, `drunk` or `no-ability`) whatever
 *   any ability's state: with `partner-in-play`, while the partner is in play, alive or dead
 *   (the Spy and the Widow poison the Damsel, the Vizier leaves the Magician with no ability,
 *   Legion the Engineer and the Hatter); with `has-partner-ability`, while they have the
 *   partner's ability (the Alchemist-Mastermind has no ability). `who: "both"` with
 *   `unlessImpaired` is that player and the partner's, while neither is otherwise drunk or
 *   poisoned (the Alchemist-Organ Grinder: both drunk while both are sober);
 * - `noKill`: no kill from the subject tonight `on`: `token`, while the partner's own
 *   `stopsWaking` or `stopsKilling` token is on its player (the Exorcist's Chosen on the
 *   Yaggababble, the Princess's Doesn't Kill on the Al-Hadikhia); `executed-partner`, no Demon
 *   kills when the subject's player nominated the partner's today and they died by execution
 *   (the Cannibal and the Princess);
 * - `grimoire`: what the subject's player sees of the Grimoire: `hides: "all"`, none of it
 *   while a partner's player has their ability (the Spy and the Widow with the Poppy Grower);
 *   a list, those tokens come off it first: `partner`, the partner's, and every token of each
 *   character type listed (with `partner-in-play`, the Spy's and the Widow's Magician and
 *   Demon);
 * - `endsGame`: a game end with the partner, worked out in `rules/jinx-ends.ts` (the
 *   Leviathan's and Riot's): `nominated-marked-executed`, the subject's player nominates the
 *   player with the partner's `token` (or, with none, the partner's own player) and they are
 *   executed, so `winner` wins; `marked-executed`, while the subject is in play the player
 *   with the partner's `token` dies by execution; `day-without-execution`, the two players are
 *   alive when day `day` ends with no execution, in place of the subject's own end that day;
 *   `partner-stops`, the partner's player stops the subject's ability (a day use with
 *   `stops`), so `winner` wins if exactly `alive` of the subject's players live, otherwise the
 *   other team (the Mayor stopping the riot); `partner-end`, with the partner's ability, the
 *   partner's `dead-without-demon` end applies to the subject's player with `winner` (the
 *   Alchemist-Summoner); `partner-chooses`, when the partner's Demon dies by execution while
 *   the subject's player lives, the subject's `extra-day` is a night instead, whose choice
 *   the partner's player makes (3 good players, all choose to live: evil wins), a `jinx-night`
 *   hold (the Mastermind with the Al-Hadikhia);
 * - `storytellerVote`: while the subject's nominees nominate straight away
 *   (`nomineesNominate`), a nominated Storyteller is voted on instead: the Storyteller judges
 *   whether they are about to die, and executes them (the partner's `storyteller-executed`
 *   end) or the nominator nominates again (the Riot with the Atheist);
 * - `deadAtLeast`: the subject's `wakesWhen` dead count is met once `dead` players are dead
 *   (with `partner-in-play`, the King with the Leviathan or Riot);
 * - `nightChoice`: each night but the first, the subject's player chooses an alive player
 *   not chosen before (`chooses: "good"`, a good one; `any`), and a chosen partner either uses
 *   its ability without dying (`partner: "acts"`) or dies and gains it (`dies`), worked out in
 *   `rules/jinx-choices.ts` (the Leviathan's and Riot's Banshee, Farmer, Ravenkeeper, Sage);
 * - `partnerSetup`: when the subject's player has the partner's ability, the partner's own
 *   setup change applies as if it were in play (the Alchemist-Summoner's [No Demon]; the
 *   Philosopher who gains the Bounty Hunter's, a `partner-setup` night alert at its step);
 * - `partnerInPlay`: when the subject's player has the partner's ability, the real partner is
 *   in play as well, a setup note (the Alchemist-Marionette, -Organ Grinder, -Spy, -Widow,
 *   -Wraith);
 * - `learns`: the subject's player learns `what`: `ability`, that they have the partner's
 *   ability, and `answer`, what the partner's own player would have learned, both on the night
 *   its `gainedFrom` gives it (the Cannibal's Butler, Zealot and Juggler); `no-ability`, at its
 *   step, that the partner took their ability (with `{"night": 1}`, the Engineer with Legion);
 *   `partner-choice`, at the partner's step, whom the partner chooses (the Vizier with the
 *   Fearmonger, a `wakes-with` night alert);
 * - `trueInfo`: the subject's `falseInfo` doesn't make the partner's information false (the
 *   Vortox's Banshee, https://wiki.bloodontheclocktower.com/Vortox#Related_Jinxes);
 * - `notDeclared`: the Storyteller doesn't declare the subject is in play: its after-Dawn step,
 *   its line in the Announcements and its `announcement` day reminders are left out (the
 *   Vizier with the Alsaahir and the Investigator);
 * - `keepsProtection`: when the partner's ability takes the subject's away, its own `protects`
 *   still holds, and its player learns this (a `keeps-protection` night alert at the
 *   partner's step: the Vizier with the Courtier and the Preacher);
 * - `noExecuteNow`: the subject's `executionOutcome.executeNow` doesn't reach this `player`
 *   (an `OutcomeProblem` `jinxed`, warned, never locked): `partner`, the partner's own player
 *   (the Magician and the Vizier); `marked` with `token`, the player with that partner's
 *   token (the Fearmonger's Fear);
 * - `allEvilBecome`: when the subject's `changesCharacter` creates the partner, every other
 *   evil player becomes it too (the Engineer's, the Hatter's and the Summoner's Legion);
 * - `partnerKeepsAbility`: the subject's `impairs` tokens never reach the partner's players,
 *   and while one would have, its player might learn the partner is in play (a `might-learn`
 *   night alert at both steps: the Minstrel's and the Preacher's Legion);
 * - `demonLearnsGood`: at Demon info the partner's players wake in separate groups and each
 *   learns which players are good, never the subject's player, who is not shown as a Minion
 *   either (with `partner-in-play`, the Magician with Legion);
 * - `storytellerHas`: the Storyteller has the subject's ability `once`: `no-ability`, its living
 *   player has none (drunk, poisoned or without one), a `storyteller-has` night alert at its
 *   step (the Summoner with the Courtier and the Preacher); `removed`, the partner's
 *   `changesCharacter` changed its living player into another character
 *   (`storytellerAbilities`, the Summoner with the Engineer);
 * - `arbitraryDeaths`: when the subject's `changesCharacter` makes a player a Demon while
 *   another living player is a Demon, deaths tonight are arbitrary, and its step says so (the
 *   Summoner with the Hatter, the Kazali and the Pit-Hag);
 * - `neighbourBecomes`: when the subject's `changesCharacter` makes a player the partner, that
 *   player must neighbour a player of `type`, and their other neighbour becomes an evil one of
 *   it (the Summoner's Lord of Typhon, a Minion);
 * - `earlierToken`: the subject's `changesCharacter` may also create the partner, and only the
 *   partner, while its player carries `token` instead of its usual one (the Summoner's Pukka
 *   on Night 2);
 * - `guessesPartner`: the subject's player may publicly guess a living player as the partner;
 *   if right, the Demon must choose the partner's player tonight, a `guessed` night alert at
 *   each Demon's step (with `self-alive` and `after-execution`, the Magician with the Wraith;
 *   with `has-partner-ability` too, the Alchemist-Spy, -Widow and -Wraith);
 * - `notShownGiven`: with the partner's ability, the subject's player isn't shown the ability
 *   the partner's `givesAbility` gave (a `not-shown-given` night alert at the partner's step:
 *   the Alchemist-Boffin);
 * - `notSecondDemon`: the subject's `becomes` never makes a second Demon while another living
 *   player is the partner: the partner passing on by its own death (`death-passes`) doesn't
 *   make the subject's player the Demon too, and a player carrying its `becomes` token becomes
 *   the subject again (the Scarlet Woman with the Fang Gu and the Al-Hadikhia);
 * - `keepsAfterPartner`: once the partner's `keepsAbility` token keeps the subject's dead
 *   player's ability, they keep it after the partner's player dies (the Mastermind with the
 *   Vigormortis);
 * - `survivesCarrierExecuted`: the carrier of the subject's `gameEnd.aliveWhileDead` token
 *   dying by execution doesn't kill the subject's player: they live on with no ability (with
 *   `partner-alive`, the Lleech with the Mastermind);
 * - `killsMarked`: the subject's kill (`deathCause.victim`) also kills the player carrying the
 *   partner's reminder `token` (the Slayer shooting the Lleech's host, "Poisoned");
 * - `madAsPartner`: the subject's `madness` may be about the partner, though the partner is
 *   not good: a `may-mad-as` night alert at its step (the Cerenovus with the Goblin);
 * - `hidesPartnerSeat`: while the subject's player is alive, at Demon info the Demon is not
 *   told which of its neighbours is the partner's player (`DemonInfo.neighbourHidden`: the
 *   Magician with the Marionette);
 * - `thinksPartnerSetup`: while the subject's player thinks they are the partner (their seat
 *   shows the partner's token), the partner's own setup change applies as if it were in play
 *   (the Marionette who thinks they are the Balloonist or the Huntsman);
 * - `uncountedVote`: while the partner's working `voting.secret` has votes cast with eyes
 *   closed, the subject's player may raise their hand without their `voter.onlyWith` player,
 *   but the vote counts only if that player voted too: no warning, the vote hint says so (the
 *   Butler with the Organ Grinder);
 * - `noBluffs`: with the partner's ability, the subject's player doesn't get the bluffs the
 *   partner's `evilInfo` notes say it gets, so those notes are left out (the
 *   Alchemist-Summoner);
 * - `abnormalCounts`: the subject's `abnormal-abilities` count also counts the partner's
 *   player when the partner's own ability made it work abnormally `because`: `own-ability`,
 *   info recorded as abnormal because of the partner's own ability (the Mathematician with the
 *   Drunk and the Marionette); `demon-choice`, the partner's `choosesLikeDemon` reminder is on
 *   none of the players the Demon killed tonight (the Mathematician with the Lunatic).
 *
 * Each verb's prerequisites, the other rules it works through (`carriedBy` needs a
 * `carrierIsDemon` token, `noKill: "token"` the partner's `stopsWaking` or `stopsKilling`), are
 * `JINX_NEEDS`: this character's side is checked as the block is read (`readJinxRules`), the
 * partner's once both are known (`jinxPartnerIssues`).
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
	type Issues,
	type Json
} from './validate.ts';
import { jinxNeedsOn } from './jinx-needs.ts';

export const JINX_WHO = ['self', 'partner'] as const;
export type JinxWho = (typeof JINX_WHO)[number];

export const JINX_FLAGS = [
	'self-alive',
	'partner-alive',
	'self-in-play',
	'partner-in-play',
	'has-partner-ability',
	'partner-has-this-ability',
	'after-execution',
	'final-day'
] as const;
export type JinxFlag = (typeof JINX_FLAGS)[number];

/** A `when` condition: a flag, or one keyed number or reminder label. */
export type JinxCondition =
	| JinxFlag
	| { afterDay: number }
	| { day: number }
	| { night: number }
	| { marked: ReminderLabel }
	| { partnerMarked: ReminderLabel };

const NUMBER_CONDITIONS = ['afterDay', 'day', 'night'] as const;
const LABEL_CONDITIONS = ['marked', 'partnerMarked'] as const;

/** What every effect may say beside its parameters. */
export interface JinxEffect {
	/** Whose behaviour it changes; `self` when left out (`both` for `impairs` only). */
	who?: JinxWho | 'both';
	when?: readonly JinxCondition[];
}

export interface CannotCreate extends JinxEffect {
	via: 'givesAbility' | 'changesCharacter';
}

export const GIVEN_INSTEAD = [
	'a-minion',
	'a-player-becomes',
	'demon-neighbour-becomes',
	'outsiders'
] as const;
export type GivenInstead = (typeof GIVEN_INSTEAD)[number];

export interface GivenInsteadRule extends JinxEffect {
	instead: GivenInstead;
}

export interface StorytellerChooses extends JinxEffect {
	what: 'player';
	creating?: 'partner';
}

/** An effect whose parameter is a character type (`alsoBecomes`, `neighbourBecomes`). */
export interface TypeEffect extends JinxEffect {
	type: CharacterType;
}

export interface CarriedBy extends JinxEffect {
	type?: CharacterType;
	marked?: ReminderLabel;
}

/** A `registersTo` entry: how the subject's player may register to the partner. */
export interface RegistersTo extends JinxEffect {
	alignments?: readonly Alignment[];
	types?: readonly CharacterType[];
	always?: true;
}

export const IMPAIR_KINDS = ['poisoned', 'drunk', 'no-ability'] as const;
export type ImpairKind = (typeof IMPAIR_KINDS)[number];

export interface Impairs extends JinxEffect {
	kind: ImpairKind;
	unlessImpaired?: true;
}

export const NO_KILL_TRIGGERS = ['token', 'executed-partner'] as const;
export type NoKillTrigger = (typeof NO_KILL_TRIGGERS)[number];

export interface NoKill extends JinxEffect {
	on: NoKillTrigger;
}

/** A hidden Grimoire token: the partner's, or every token of a character type. */
export type GrimoireHidden = 'partner' | CharacterType;
const GRIMOIRE_HIDDEN: readonly GrimoireHidden[] = ['partner', ...CHARACTER_TYPES];

export interface GrimoireRule extends JinxEffect {
	hides: 'all' | readonly GrimoireHidden[];
}

export const JINX_END_KINDS = [
	'nominated-marked-executed',
	'marked-executed',
	'day-without-execution',
	'partner-stops',
	'partner-end',
	'partner-chooses'
] as const;
export type JinxEndKind = (typeof JINX_END_KINDS)[number];

/** An `endsGame` entry: how the game ends with the partner, and who wins. */
export interface JinxEnd extends JinxEffect {
	kind: JinxEndKind;
	/** Who wins; `partner-chooses` has none, the partner's player's choice decides. */
	winner?: Alignment;
	/** One of the partner's reminders, on the player it is about. */
	token?: ReminderLabel;
	/** The day whose end it is checked at (`day-without-execution`). */
	day?: number;
	/** How many of the subject's players alive give `winner` the game (`partner-stops`). */
	alive?: number;
}

export interface DeadAtLeast extends JinxEffect {
	dead: number;
}

export const NIGHT_CHOICE_CHOOSES = ['good', 'any'] as const;
export const NIGHT_CHOICE_PARTNER = ['acts', 'dies'] as const;

/** A `nightChoice` entry: whom the subject chooses each night, and what a chosen partner does. */
export interface NightChoice extends JinxEffect {
	/** `good`: only an alive good player; `any`: any alive player. */
	chooses: (typeof NIGHT_CHOICE_CHOOSES)[number];
	/** `acts`: the partner uses its ability but does not die; `dies`: it dies and gains it. */
	partner: (typeof NIGHT_CHOICE_PARTNER)[number];
}

export const LEARNS = ['ability', 'answer', 'no-ability', 'partner-choice'] as const;
export type LearnsWhat = (typeof LEARNS)[number];
/** What a player learns the night `gainedFrom` gives them the partner's ability. */
export type LearnsGained = Extract<LearnsWhat, 'ability' | 'answer'>;

export interface Learns extends JinxEffect {
	what: LearnsWhat;
}

export const NO_EXECUTE_NOW_PLAYER = ['partner', 'marked'] as const;

/** A `noExecuteNow` entry: the player the subject's execute-now doesn't reach. */
export interface NoExecuteNow extends JinxEffect {
	/** `partner`: the partner's own player; `marked`: the player with the partner's `token`. */
	player: (typeof NO_EXECUTE_NOW_PLAYER)[number];
	token?: ReminderLabel;
}

export const STORYTELLER_HAS = ['no-ability', 'removed'] as const;
export type StorytellerHasOnce = (typeof STORYTELLER_HAS)[number];

export interface StorytellerHas extends JinxEffect {
	once: StorytellerHasOnce;
}

/** An effect whose parameter is one of the partner's reminders (`earlierToken`, `killsMarked`). */
export interface TokenEffect extends JinxEffect {
	token: ReminderLabel;
}

export const ABNORMAL_COUNTS = ['own-ability', 'demon-choice'] as const;
export type AbnormalCounts = (typeof ABNORMAL_COUNTS)[number];

export interface AbnormalCountsRule extends JinxEffect {
	because: AbnormalCounts;
}

/** One jinx's effects, as written in one file, or as read for one character of the pair. */
export interface JinxRules {
	exclusive?: true;
	cannotCreate?: CannotCreate;
	givenInstead?: GivenInsteadRule;
	noTurnGood?: JinxEffect;
	spareToken?: JinxEffect;
	storytellerChooses?: StorytellerChooses;
	alsoBecomes?: TypeEffect;
	carriedBy?: CarriedBy;
	diesWhenExecuted?: JinxEffect;
	registersTo?: RegistersTo;
	impairs?: Impairs;
	noKill?: NoKill;
	grimoire?: GrimoireRule;
	endsGame?: JinxEnd;
	storytellerVote?: JinxEffect;
	deadAtLeast?: DeadAtLeast;
	nightChoice?: NightChoice;
	partnerSetup?: JinxEffect;
	partnerInPlay?: JinxEffect;
	learns?: Learns;
	trueInfo?: JinxEffect;
	notDeclared?: JinxEffect;
	keepsProtection?: JinxEffect;
	noExecuteNow?: NoExecuteNow;
	allEvilBecome?: JinxEffect;
	partnerKeepsAbility?: JinxEffect;
	demonLearnsGood?: JinxEffect;
	storytellerHas?: StorytellerHas;
	arbitraryDeaths?: JinxEffect;
	neighbourBecomes?: TypeEffect;
	earlierToken?: TokenEffect;
	guessesPartner?: JinxEffect;
	notShownGiven?: JinxEffect;
	notSecondDemon?: JinxEffect;
	keepsAfterPartner?: JinxEffect;
	survivesCarrierExecuted?: JinxEffect;
	killsMarked?: TokenEffect;
	madAsPartner?: JinxEffect;
	hidesPartnerSeat?: JinxEffect;
	thinksPartnerSetup?: JinxEffect;
	uncountedVote?: JinxEffect;
	noBluffs?: JinxEffect;
	abnormalCounts?: AbnormalCountsRule;
}

export type JinxRuleKey = keyof JinxRules;

/** How one verb's parameters are read: its fields, its main one (for a bare value), its reader. */
interface Verb {
	fields: readonly string[];
	main?: string;
	read: (raw: Json, path: string, issues: Issues) => Json | undefined;
	/** `both` is allowed as `who`. */
	both?: true;
}

const plain: Verb = { fields: [], read: () => ({}) };

const enumVerb = (field: string, values: readonly string[]): Verb => ({
	fields: [field],
	main: field,
	read: (raw, path, issues) => {
		const value = readEnum(raw, field, values, path, issues, true);
		return value === undefined ? undefined : { [field]: value };
	}
});

const labelVerb = (field: string): Verb => ({
	fields: [field],
	main: field,
	read: (raw, path, issues) => {
		const value = readString(raw, field, path, issues, true);
		return value === undefined ? undefined : { [field]: value };
	}
});

/** A non-empty list of known values, or undefined (with an issue) when it is not one. */
function readEnumList<T extends string>(
	raw: Json,
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

/** A whole number of 1 or more, with an issue when it is missing or isn't one. */
function readPositive(raw: Json, key: string, path: string, issues: Issues): number | undefined {
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

function readEnd(raw: Json, path: string, issues: Issues): Json | undefined {
	const kind = readEnum(raw, 'kind', JINX_END_KINDS, path, issues, true);
	if (!kind) return undefined;
	const extra: readonly string[] = {
		'nominated-marked-executed': ['token'],
		'marked-executed': ['token'],
		'day-without-execution': ['day'],
		'partner-stops': ['alive'],
		'partner-end': [],
		'partner-chooses': []
	}[kind];
	const winnerless = kind === 'partner-chooses';
	checkKeys(
		raw,
		['kind', ...(winnerless ? [] : ['winner']), ...extra, 'who', 'when'],
		path,
		issues
	);
	const winner = winnerless ? undefined : readEnum(raw, 'winner', ALIGNMENTS, path, issues, true);
	if (!winnerless && !winner) return undefined;
	const out: Json = { kind, ...(winner ? { winner } : {}) };
	if (extra.includes('token')) {
		const token = readString(raw, 'token', path, issues, kind === 'marked-executed');
		if (token !== undefined) out.token = token;
		if (kind === 'marked-executed' && token === undefined) return undefined;
	}
	for (const key of ['day', 'alive'] as const) {
		if (!extra.includes(key)) continue;
		const n = readPositive(raw, key, path, issues);
		if (n === undefined) return undefined;
		out[key] = n;
	}
	return out;
}

const VERBS: Record<Exclude<JinxRuleKey, 'exclusive'>, Verb> = {
	cannotCreate: enumVerb('via', ['givesAbility', 'changesCharacter']),
	givenInstead: enumVerb('instead', GIVEN_INSTEAD),
	noTurnGood: plain,
	spareToken: plain,
	storytellerChooses: {
		fields: ['what', 'creating'],
		main: 'what',
		read: (raw, path, issues) => {
			const what = readEnum(raw, 'what', ['player'], path, issues, true);
			const creating = readEnum(raw, 'creating', ['partner'], path, issues, false);
			return what ? { what, ...(creating ? { creating } : {}) } : undefined;
		}
	},
	alsoBecomes: enumVerb('type', CHARACTER_TYPES),
	carriedBy: {
		fields: ['type', 'marked'],
		read: (raw, path, issues) => {
			const type = readEnum(raw, 'type', CHARACTER_TYPES, path, issues, false);
			const marked = readString(raw, 'marked', path, issues, false);
			if ((type === undefined) === (marked === undefined)) {
				issues.add(path, 'needs type or marked, not both');
				return undefined;
			}
			return type ? { type } : { marked };
		}
	},
	diesWhenExecuted: plain,
	registersTo: {
		fields: ['alignments', 'types', 'always'],
		read: (raw, path, issues) => {
			const out: Json = {};
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
	},
	impairs: {
		fields: ['kind', 'unlessImpaired'],
		main: 'kind',
		both: true,
		read: (raw, path, issues) => {
			const kind = readEnum(raw, 'kind', IMPAIR_KINDS, path, issues, true);
			const unless = readBoolean(raw, 'unlessImpaired', path, issues);
			return kind ? { kind, ...(unless ? { unlessImpaired: true } : {}) } : undefined;
		}
	},
	noKill: enumVerb('on', NO_KILL_TRIGGERS),
	grimoire: {
		fields: ['hides'],
		main: 'hides',
		read: (raw, path, issues) => {
			if (raw.hides === 'all') return { hides: 'all' };
			const hides = readEnumList(raw, 'hides', GRIMOIRE_HIDDEN, path, issues);
			if (raw.hides === undefined) issues.add(`${path}.hides`, 'missing');
			return hides ? { hides } : undefined;
		}
	},
	endsGame: { fields: [], read: readEnd },
	storytellerVote: plain,
	deadAtLeast: {
		fields: ['dead'],
		main: 'dead',
		read: (raw, path, issues) => {
			const dead = readPositive(raw, 'dead', path, issues);
			return dead === undefined ? undefined : { dead };
		}
	},
	nightChoice: {
		fields: ['chooses', 'partner'],
		read: (raw, path, issues) => {
			const chooses = readEnum(raw, 'chooses', NIGHT_CHOICE_CHOOSES, path, issues, true);
			const partner = readEnum(raw, 'partner', NIGHT_CHOICE_PARTNER, path, issues, true);
			return chooses && partner ? { chooses, partner } : undefined;
		}
	},
	partnerSetup: plain,
	partnerInPlay: plain,
	learns: enumVerb('what', LEARNS),
	trueInfo: plain,
	notDeclared: plain,
	keepsProtection: plain,
	noExecuteNow: {
		fields: ['player', 'token'],
		main: 'player',
		read: (raw, path, issues) => {
			const player = readEnum(raw, 'player', NO_EXECUTE_NOW_PLAYER, path, issues, true);
			const token = readString(raw, 'token', path, issues, player === 'marked');
			if (!player || (player === 'marked' && token === undefined)) return undefined;
			return player === 'marked' ? { player, token } : { player };
		}
	},
	allEvilBecome: plain,
	partnerKeepsAbility: plain,
	demonLearnsGood: plain,
	storytellerHas: enumVerb('once', STORYTELLER_HAS),
	arbitraryDeaths: plain,
	neighbourBecomes: enumVerb('type', CHARACTER_TYPES),
	earlierToken: labelVerb('token'),
	guessesPartner: plain,
	notShownGiven: plain,
	notSecondDemon: plain,
	keepsAfterPartner: plain,
	survivesCarrierExecuted: plain,
	killsMarked: labelVerb('token'),
	madAsPartner: plain,
	hidesPartnerSeat: plain,
	thinksPartnerSetup: plain,
	uncountedVote: plain,
	noBluffs: plain,
	abnormalCounts: enumVerb('because', ABNORMAL_COUNTS)
};

/** Every key a jinx entry may have: `exclusive`, then each verb. */
export const JINX_RULE_KEYS: readonly JinxRuleKey[] = [
	'exclusive',
	...(Object.keys(VERBS) as Exclude<JinxRuleKey, 'exclusive'>[])
];

function readCondition(raw: unknown, path: string, issues: Issues): JinxCondition | undefined {
	if (typeof raw === 'string') {
		if ((JINX_FLAGS as readonly string[]).includes(raw)) return raw as JinxFlag;
		issues.add(path, `unknown condition ${JSON.stringify(raw)}`);
		return undefined;
	}
	const keys = isObject(raw) ? Object.keys(raw) : [];
	if (!isObject(raw) || keys.length !== 1) {
		issues.add(path, `expected a condition, got ${describe(raw)}`);
		return undefined;
	}
	const [key] = keys;
	if ((NUMBER_CONDITIONS as readonly string[]).includes(key)) {
		const n = readPositive(raw, key, path, issues);
		return n === undefined ? undefined : ({ [key]: n } as JinxCondition);
	}
	if ((LABEL_CONDITIONS as readonly string[]).includes(key)) {
		const label = readString(raw, key, path, issues, true);
		return label === undefined ? undefined : ({ [key]: label } as JinxCondition);
	}
	issues.add(`${path}.${key}`, 'unknown condition');
	return undefined;
}

/** One effect, from `true`, a bare main value or an object; undefined (with an issue) if bad. */
function readEffect(
	key: Exclude<JinxRuleKey, 'exclusive'>,
	raw: unknown,
	path: string,
	issues: Issues
): JinxEffect | undefined {
	const verb = VERBS[key];
	let obj: Json;
	if (raw === true && verb.main === undefined) obj = {};
	else if (verb.main !== undefined && (typeof raw === 'string' || typeof raw === 'number'))
		obj = { [verb.main]: raw };
	else if (isObject(raw)) obj = raw;
	else {
		issues.add(
			path,
			`expected ${verb.main ? 'a value or object' : 'true or object'}, got ${describe(raw)}`
		);
		return undefined;
	}
	const before = issues.list.length;
	if (key !== 'endsGame') checkKeys(obj, [...verb.fields, 'who', 'when'], path, issues);
	const who = readEnum(
		obj,
		'who',
		verb.both ? [...JINX_WHO, 'both'] : JINX_WHO,
		path,
		issues,
		false
	);
	let when: JinxCondition[] | undefined;
	if (obj.when !== undefined) {
		if (!Array.isArray(obj.when) || obj.when.length === 0)
			issues.add(`${path}.when`, `expected a list of conditions, got ${describe(obj.when)}`);
		else when = obj.when.map((c, i) => readCondition(c, `${path}.when[${i}]`, issues)!);
	}
	const params = verb.read(obj, path, issues);
	if (!params || issues.list.length > before) return undefined;
	return { ...params, ...(who ? { who } : {}), ...(when ? { when } : {}) } as JinxEffect;
}

/**
 * Reads a `jinxes` block: one entry per jinxed partner, each saying at least one thing.
 * `self`, the rules block it is in, lets an effect whose prerequisite is missing there be
 * reported (`JINX_NEEDS`).
 */
export function readJinxRules(
	raw: unknown,
	path: string,
	issues: Issues,
	self?: Json
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
		const rules: Record<string, unknown> = {};
		if (readBoolean(entry, 'exclusive', at, issues)) rules.exclusive = true;
		for (const key of Object.keys(VERBS) as Exclude<JinxRuleKey, 'exclusive'>[]) {
			const value = entry[key];
			if (value === undefined || value === false) continue;
			const effect = readEffect(key, value, `${at}.${key}`, issues);
			if (effect) rules[key] = effect;
		}
		if (Object.keys(rules).length === 0) {
			issues.add(at, 'a jinx entry needs at least one rule');
			continue;
		}
		if (self)
			for (const { key, parts } of jinxNeedsOn(rules, 'self'))
				if (!parts.some((p) => self[p] !== undefined))
					issues.add(`${at}.${key}`, `needs ${parts.map((p) => `\`${p}\``).join(' or ')} here`);
		out[partner] = rules as JinxRules;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}
