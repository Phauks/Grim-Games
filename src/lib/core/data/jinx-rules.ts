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
 * **Custom scripts** (M40, `script-jinx-rules.ts`): a script's jinx entry may carry `rules` in
 * this format, `{"id": "<partner>", "reason": "…", "rules": {<verbs>}}`, `self` being the entry
 * that holds it (a custom character, or an official one's `{"id", "jinxes"}`). A script's jinx
 * replaces TPI's for its pair: only its `rules`, and a custom character's own `rules.jinxes`,
 * count, never these files, and with none it is text only (`rulesForJinx`). Rules the app
 * can't use are dropped with a script load warning, and the script still loads; rules that load
 * but can never change anything warn too, and stay (`jinx-no-ops.ts`). The usual homebrew case
 * is a `who: "partner"` effect on the custom character's own entry, its `when` written from
 * that character's side.
 *
 * Conditions (`when`): `self-alive`, `partner-alive`, `self-dead`, `partner-dead`,
 * `self-in-play`, `partner-in-play`, `self-executed`, `partner-executed`,
 * `has-partner-ability`, `after-execution`, `final-day`, `{"day"}`, `{"night"}`,
 * `{"afterDay"}`, `{"marked"}`, `{"partnerMarked"}`, `{"alignment"}`, `{"partnerAlignment"}`,
 * a third character's `{"alive"}` and `{"inPlay"}`, and `{"not": <condition>}`. Each is
 * documented, with a worked example from a script entry, in `jinx-conditions.ts`.
 *
 * **What the app does.** Most verbs change what the app does: a picker, where a reminder
 * fits, an ability's state, a registration, a protection, a setup count, a step or a game end
 * (often with a night alert as well). These only tell the Storyteller, who applies them: a
 * night alert or a note on a step, never enforced: `storytellerChooses` with `player` or
 * `carrier`, `wakesOneByOne`, `grimoire`, `noKill` with `token` or `executed-partner`, every
 * `learns`, `partnerInPlay`, `arbitraryDeaths`, `guessesPartner`, `notShownGiven`,
 * `madAsPartner`, and `storytellerHas` `no-ability`.
 *
 * **Needs.** A verb that works through another part of a character's rules says so ("Needs
 * …"): on its subject unless the bullet says the partner. Without it the rule does nothing, so
 * it is a load error in our files and a script load warning (`JINX_NEEDS`, `jinx-needs.ts`).
 *
 * The verbs, each with an official example (or, for M44's, the homebrew case it is for):
 * - `exclusive`: only one of the two may be in play, so choosing both warns at setup and a
 *   change that would put both in play warns (the Heretic's six,
 *   https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes). Always `true`: it is about
 *   the pair, so it takes no `who` or `when`;
 * - `cannotCreate`: the subject's ability named by `via` never makes the partner:
 *   `givesAbility` never gives its ability, `changesCharacter` never makes a player it (the
 *   Boffin's Drunk, Heretic, Ogre and Politician; with `{"afterDay": 5}`, the Pit-Hag's and the
 *   Hatter's Leviathan, https://wiki.bloodontheclocktower.com/Leviathan#Related_Jinxes). Needs
 *   that `via` part;
 * - `cannotChoose` (M44): the subject's player can't choose the partner's player (a custom
 *   Lamplighter that can't choose the Vizier; `who: "partner"` for the reverse). The subject's
 *   reminders mark its choices, so the partner's seats are faded while one is dragged and
 *   placing it there warns (`jinx-choice`), and its step has a `cannot-choose` night alert;
 * - `givenInstead`: when the subject's `givesAbility` would give the partner's ability to the
 *   Storyteller, `instead` happens: `a-minion`, a Minion holds it and learns this;
 *   `a-player-becomes`, a player becomes the partner; `demon-neighbour-becomes`, one of the
 *   Demon's good neighbours becomes it; `outsiders`, up to two players become Outsiders (the
 *   Plague Doctor's, https://wiki.bloodontheclocktower.com/Plague_Doctor#Related_Jinxes).
 *   Needs `givesAbility`;
 * - `noTurnGood`: a player the subject gives the partner's ability to (`givesAbility`), or
 *   turns from evil into the partner (`changesCharacter`), can't turn good by that ability: no
 *   change to good is offered and one made by hand warns (the Boffin's and the Pit-Hag's Cult
 *   Leader and Goon). Needs `givesAbility` or `changesCharacter`;
 * - `spareToken`: with a spare token, the subject may give or create the partner even while
 *   it is in play, so its picker offers it (the Boffin's and the Pit-Hag's Village Idiot).
 *   Needs `givesAbility` or `changesCharacter`;
 * - `storytellerChooses`: the Storyteller makes a choice the subject's players would make.
 *   `what: "player"`: when the subject's `changesCharacter` (its own, or the partner's with
 *   `has-partner-ability`) changes a player, the Storyteller chooses which, and the subject's
 *   player only the character; with `creating: "partner"`, only when it makes the partner (the
 *   Pit-Hag's Damsel; with `partner-alive`, the Summoner while the Poppy Grower lives; with
 *   `has-partner-ability`, the Alchemist-Summoner). Needs `changesCharacter`. `what:
 *   "carrier"`: the Storyteller, not the players who wake for the subject, chooses who carries
 *   its `carrierIsDemon` token, a `storyteller-chooses` night alert at its step (with
 *   `partner-alive`, the Magician's Lil' Monsta,
 *   https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes). Needs `carrierIsDemon`.
 *   `what: "another-player"` (M44): when the subject's choice would land on the partner's
 *   player, the Storyteller chooses another player instead (a custom script's Widow who would
 *   poison its Lamplighter); faded and warned like `cannotChoose` (`jinx-redirect`), with a
 *   `storyteller-redirects` night alert;
 * - `wakesOneByOne`: the players who wake for the subject to choose who carries its
 *   `carrierIsDemon` token wake one at a time, so they don't learn each other, until one
 *   chooses to take it, a `wakes-one-by-one` night alert at its step (with `partner-alive`, the
 *   Poppy Grower's Lil' Monsta,
 *   https://wiki.bloodontheclocktower.com/Poppy_Grower#Related_Jinxes). Needs `carrierIsDemon`;
 * - `alsoBecomes`: when the subject's `changesCharacter` would make a player the partner, who
 *   is never dealt, they also choose a character of `type` and become that (the Hatter's Lil'
 *   Monsta, https://wiki.bloodontheclocktower.com/Hatter#Related_Jinxes). Needs
 *   `changesCharacter`;
 * - `carriedBy`: who may carry the subject's `carrierIsDemon` token: only a player of `type`
 *   (with `partner-alive`, the Magician's and the Poppy Grower's Lil' Monsta goes to a
 *   Minion), or, once a player carries the partner's reminder `marked`, only that player (the
 *   Scarlet Woman babysits Lil' Monsta, https://wiki.bloodontheclocktower.com/Lil%27_Monsta).
 *   Needs `carrierIsDemon`;
 * - `diesWhenExecuted`: the subject's own `protects` doesn't save its player from execution
 *   (with `{"marked": "Is The Demon"}`, the Psychopath and the Vizier babysitting Lil' Monsta).
 *   Needs `protects`;
 * - `registersTo`: the subject's player may also register as these `alignments` and `types`
 *   to the partner's ability, or with `always` only as them, whatever its own ability's state
 *   (the Politician as evil to Legion, the Spy always as evil to the Ogre, each page's Related
 *   Jinxes). Without `always` it only adds: listing what the subject already may register as
 *   (the Spy as good) changes nothing, and the script warns;
 * - `impairs`: the subject's player is `kind` (`poisoned`, `drunk` or `no-ability`) whatever
 *   any ability's state: with `partner-in-play`, while the partner is in play, alive or dead
 *   (the Spy and the Widow poison the Damsel, the Vizier leaves the Magician with no ability,
 *   Legion the Engineer and the Hatter); with `has-partner-ability`, while they have the
 *   partner's ability (the Alchemist-Mastermind has no ability; needs `gainsAbilityOf` or
 *   `gainedFrom`). `who: "both"` with `unlessImpaired` is that player and the partner's, while
 *   neither is otherwise drunk or poisoned (the Alchemist-Organ Grinder: both drunk while both
 *   are sober);
 * - `noKill`: no kill from the subject tonight `on`: `token`, while the partner's own
 *   `stopsWaking` or `stopsKilling` token is on its player (the Exorcist's Chosen on the
 *   Yaggababble, the Princess's Doesn't Kill on the Al-Hadikhia; needs the partner's
 *   `stopsWaking` or `stopsKilling`, and is only worth writing where that token wouldn't stop
 *   the kill by itself); `executed-partner`, no Demon kills when the subject's player
 *   nominated the partner's today and they died by execution (the Cannibal and the Princess);
 *   `chosen` (M44), the partner's player chose the subject's player tonight, marked by one of
 *   the partner's reminders placed on them tonight (`token`, or any of its own), with no
 *   kill-stopping token needed (a custom Lamplighter that chooses the Imp). `chosen` takes the
 *   kill off the step (`night-kill.ts`); each is a `no-kill` night alert;
 * - `grimoire`: what the subject's player sees of the Grimoire: `hides: "all"`, none of it
 *   while a partner's player has their ability (the Spy and the Widow with the Poppy Grower);
 *   a list, those tokens come off it first: `partner`, the partner's, and every token of each
 *   character type listed (with `partner-in-play`, the Spy's and the Widow's Magician and
 *   Demon);
 * - `endsGame`: a game end with the partner, worked out in `rules/jinx-ends.ts` (the
 *   Leviathan's and Riot's), its `when` checked at the moment of its event:
 *   `nominated-marked-executed`, the subject's player nominates the player with the partner's
 *   `token` (optional: with none, the partner's own player) and they are executed, so `winner`
 *   wins; `marked-executed`, while the subject is in play the player with the partner's
 *   `token` (required) dies by execution; `executed` (M44), the subject's own player, or with
 *   `player: "partner"` the partner's, is executed, so `winner` wins, with no token and no
 *   nomination (a custom script's "if the Lamplighter is executed while the Saint lives, good
 *   wins", with `partner-alive` as it stood just before the execution);
 *   `day-without-execution`, the two players are alive when day `day` ends with no execution,
 *   in place of the subject's own end that day (`day` may be left out when `when` has
 *   `final-day`: then the latest day that ended); `partner-stops`, the partner's player stops
 *   the subject's ability (a day use with `stops`), so `winner` wins if exactly `alive` of the
 *   subject's players live, otherwise the other team (the Mayor stopping the riot);
 *   `partner-end`, with the partner's ability, the partner's `dead-without-demon` end applies
 *   to the subject's player with `winner` (the Alchemist-Summoner); `partner-chooses`, when
 *   the partner's Demon dies by execution while the subject's player lives, the subject's
 *   `extra-day` is a night instead, whose choice the partner's player makes (3 good players,
 *   all choose to live: evil wins), a `jinx-night` hold (the Mastermind with the Al-Hadikhia).
 *   The last three are one official pair's own mechanic;
 * - `storytellerVote`: while the subject's nominees nominate straight away
 *   (`nomineesNominate`), a nominated Storyteller is voted on instead: the Storyteller judges
 *   whether they are about to die, and executes them (the partner's `storyteller-executed`
 *   end) or the nominator nominates again (the Riot with the Atheist). Needs
 *   `nomineesNominate`;
 * - `deadAtLeast`: the subject's `wakesWhen` dead count is met once `dead` players are dead
 *   (with `partner-in-play`, the King with the Leviathan or Riot). Needs `wakesWhen`;
 * - `nightChoice`: each night but the first, the subject's player chooses an alive player
 *   not chosen before (`chooses: "good"`, a good one; `any`), and a chosen partner either uses
 *   its ability without dying (`partner: "acts"`) or dies and gains it (`dies`), worked out in
 *   `rules/jinx-choices.ts` (the Leviathan's and Riot's Banshee, Farmer, Ravenkeeper, Sage);
 * - `partnerSetup`: when the subject's player has the partner's ability, the partner's own
 *   setup change applies as if it were in play (the Alchemist-Summoner's [No Demon]; the
 *   Philosopher who gains the Bounty Hunter's, a `partner-setup` night alert at its step).
 *   Needs `gainsAbilityOf` or `gainedFrom`, and the partner's `setupModifier`;
 * - `partnerInPlay`: when the subject's player has the partner's ability, the real partner is
 *   in play as well, a setup note (the Alchemist-Marionette, -Organ Grinder, -Spy, -Widow,
 *   -Wraith). Needs `gainsAbilityOf` or `gainedFrom`;
 * - `learns`: the subject's player learns `what`: `ability`, that they have the partner's
 *   ability, and `answer`, what the partner's own player would have learned, both on the night
 *   its `gainedFrom` gives it (the Cannibal's Butler, Zealot and Juggler; needs `gainedFrom`);
 *   `no-ability`, at its step, that the partner took their ability (with `{"night": 1}`, the
 *   Engineer with Legion); `partner-choice`, at the partner's step, whom the partner chooses
 *   (the Vizier with the Fearmonger, a `wakes-with` night alert); `alignment`, at its own step,
 *   which alignment they are, a `learns-alignment` night alert (with `{"partnerMarked":
 *   "Friend"}` and `{"alignment": "evil"}`, the Ogre whose Friend is the Recluse, registering
 *   as evil, https://wiki.bloodontheclocktower.com/Ogre#Related_Jinxes); `character` (M44), at
 *   its own step, a partner's player's true character, a `learns-character` night alert (with
 *   `partner-executed`, a custom script's Undertaker who also learns the executed
 *   Lamplighter's);
 * - `trueInfo`: the subject's `falseInfo` doesn't make the partner's information false (the
 *   Vortox's Banshee, https://wiki.bloodontheclocktower.com/Vortox#Related_Jinxes). Needs
 *   `falseInfo`;
 * - `notDeclared`: the Storyteller doesn't declare the subject is in play: its after-Dawn step,
 *   its line in the Announcements and its `announcement` day reminders are left out (the
 *   Vizier with the Alsaahir and the Investigator);
 * - `keepsProtection`: when the partner's ability takes the subject's away, its own `protects`
 *   still holds, and its player learns this (a `keeps-protection` night alert at the
 *   partner's step: the Vizier with the Courtier and the Preacher). Needs `protects`;
 * - `noExecuteNow`: the subject's `executionOutcome.executeNow` doesn't reach this `player`
 *   (an `OutcomeProblem` `jinxed`, warned, never locked): `partner`, the partner's own player
 *   (the Magician and the Vizier); `marked` with `token`, the player with that partner's
 *   token (the Fearmonger's Fear). Needs `executionOutcome`;
 * - `allEvilBecome`: when the subject's `changesCharacter` creates the partner, every other
 *   evil player becomes it too (the Engineer's, the Hatter's and the Summoner's Legion). Needs
 *   `changesCharacter`;
 * - `partnerKeepsAbility`: the subject's `impairs` tokens never reach the partner's players,
 *   and while one would have, its player might learn the partner is in play (a `might-learn`
 *   night alert at both steps: the Minstrel's and the Preacher's Legion). Needs `impairs`;
 * - `demonLearnsGood`: at Demon info the partner's players wake in separate groups and each
 *   learns which players are good, never the subject's player, who is not shown as a Minion
 *   either (with `partner-in-play`, the Magician with Legion). One pair's mechanic;
 * - `storytellerHas`: the Storyteller has the subject's ability `once`: `no-ability`, its living
 *   player has none (drunk, poisoned or without one), a `storyteller-has` night alert at its
 *   step (the Summoner with the Courtier and the Preacher); `removed`, the partner's
 *   `changesCharacter` changed its living player into another character
 *   (`storytellerAbilities`, the Summoner with the Engineer; needs the partner's
 *   `changesCharacter`);
 * - `arbitraryDeaths`: when the subject's `changesCharacter` makes a player a Demon while
 *   another living player is a Demon, deaths tonight are arbitrary, and its step says so (the
 *   Summoner with the Hatter, the Kazali and the Pit-Hag). Needs `changesCharacter`;
 * - `neighbourBecomes`: when the subject's `changesCharacter` makes a player the partner, that
 *   player must neighbour a player of `type`, and their other neighbour becomes an evil one of
 *   it (the Summoner's Lord of Typhon, a Minion). Needs `changesCharacter`;
 * - `earlierToken`: the subject's `changesCharacter` may also create the partner, and only the
 *   partner, while its player carries `token` instead of its usual one (the Summoner's Pukka
 *   on Night 2). Needs `changesCharacter`;
 * - `guessesPartner`: the subject's player may publicly guess a living player as the partner;
 *   if right, the Demon must choose the partner's player tonight, a `guessed` night alert at
 *   each Demon's step (with `self-alive` and `after-execution`, the Magician with the Wraith;
 *   with `has-partner-ability` too, the Alchemist-Spy, -Widow and -Wraith);
 * - `notShownGiven`: with the partner's ability, the subject's player isn't shown the ability
 *   the partner's `givesAbility` gave (a `not-shown-given` night alert at the partner's step:
 *   the Alchemist-Boffin). Needs the partner's `givesAbility`;
 * - `notSecondDemon`: the subject's `becomes` never makes a second Demon while another living
 *   player is the partner: the partner passing on by its own death (`death-passes`) doesn't
 *   make the subject's player the Demon too, and a player carrying its `becomes` token becomes
 *   the subject again (the Scarlet Woman with the Fang Gu and the Al-Hadikhia). Needs
 *   `becomes`;
 * - `keepsAfterPartner`: once the partner's `keepsAbility` token keeps the subject's dead
 *   player's ability, they keep it after the partner's player dies (the Mastermind with the
 *   Vigormortis). Needs the partner's `keepsAbility`;
 * - `survivesCarrierExecuted`: the carrier of the subject's `gameEnd.aliveWhileDead` token
 *   dying by execution doesn't kill the subject's player: they live on with no ability (with
 *   `partner-alive`, the Lleech with the Mastermind). Needs `gameEnd`;
 * - `killsMarked`: the subject's kill (`deathCause.victim`) also kills the player carrying the
 *   partner's reminder `token` (the Slayer shooting the Lleech's host, "Poisoned");
 * - `madAsPartner`: the subject's `madness` may be about the partner, though the partner is
 *   not good: a `may-mad-as` night alert at its step (the Cerenovus with the Goblin). Needs
 *   `madness`;
 * - `hidesPartnerSeat`: while the subject's player is alive, at Demon info the Demon is not
 *   told which of its neighbours is the partner's player (`DemonInfo.neighbourHidden`: the
 *   Magician with the Marionette). One pair's mechanic;
 * - `thinksPartnerSetup`: while the subject's player thinks they are the partner (their seat
 *   shows the partner's token), the partner's own setup change applies as if it were in play
 *   (the Marionette who thinks they are the Balloonist or the Huntsman). Needs the partner's
 *   `setupModifier`;
 * - `uncountedVote`: while the partner's working `voting.secret` has votes cast with eyes
 *   closed, the subject's player may raise their hand without their `voter.onlyWith` player,
 *   but the vote counts only if that player voted too: no warning, the vote hint says so (the
 *   Butler with the Organ Grinder). Needs `voter`, and the partner's `voting`;
 * - `noBluffs`: with the partner's ability, the subject's player doesn't get the bluffs the
 *   partner's `evilInfo` notes say it gets, so those notes are left out (the
 *   Alchemist-Summoner);
 * - `abnormalCounts`: the subject's `abnormal-abilities` count also counts the partner's
 *   player when the partner's own ability made it work abnormally `because`: `own-ability`,
 *   info recorded as abnormal because of the partner's own ability (the Mathematician with the
 *   Drunk and the Marionette); `demon-choice`, the partner's `choosesLikeDemon` reminder is on
 *   none of the players the Demon killed tonight (the Mathematician with the Lunatic; needs
 *   the partner's `choosesLikeDemon`).
 *
 * The prerequisites are `JINX_NEEDS`: this character's side is checked as the block is read
 * (`readJinxRules`, `jinx-read.ts`), the partner's once both are known (`jinxPartnerIssues`).
 */
import {
	CHARACTER_TYPES,
	type Alignment,
	type CharacterType,
	type ReminderLabel
} from './types.ts';
import type { JinxCondition } from './jinx-conditions.ts';

export { JINX_FLAGS, type JinxCondition, type JinxFlag } from './jinx-conditions.ts';

export const JINX_WHO = ['self', 'partner'] as const;
export type JinxWho = (typeof JINX_WHO)[number];

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

export const STORYTELLER_CHOOSES = ['player', 'carrier', 'another-player'] as const;

export interface StorytellerChooses extends JinxEffect {
	/**
	 * `player`: whom `changesCharacter` changes; `carrier`: who carries `carrierIsDemon`;
	 * `another-player`: whom the subject's choice lands on, when it would be the partner's player.
	 */
	what: (typeof STORYTELLER_CHOOSES)[number];
	/** With `player` only. */
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

export const NO_KILL_TRIGGERS = ['token', 'executed-partner', 'chosen'] as const;
export type NoKillTrigger = (typeof NO_KILL_TRIGGERS)[number];

export interface NoKill extends JinxEffect {
	on: NoKillTrigger;
	/** With `chosen` only: the partner's reminder that marks its choice; any of them without. */
	token?: ReminderLabel;
}

/** A hidden Grimoire token: the partner's, or every token of a character type. */
export type GrimoireHidden = 'partner' | CharacterType;
export const GRIMOIRE_HIDDEN: readonly GrimoireHidden[] = ['partner', ...CHARACTER_TYPES];

export interface GrimoireRule extends JinxEffect {
	hides: 'all' | readonly GrimoireHidden[];
}

export const JINX_END_KINDS = [
	'nominated-marked-executed',
	'marked-executed',
	'day-without-execution',
	'partner-stops',
	'partner-end',
	'partner-chooses',
	'executed'
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
	/** Whose player's execution ends it (`executed`): the subject's, the default, or the partner's. */
	player?: JinxWho;
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

export const LEARNS = [
	'ability',
	'answer',
	'no-ability',
	'partner-choice',
	'alignment',
	'character'
] as const;
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
	cannotChoose?: JinxEffect;
	givenInstead?: GivenInsteadRule;
	noTurnGood?: JinxEffect;
	spareToken?: JinxEffect;
	storytellerChooses?: StorytellerChooses;
	wakesOneByOne?: JinxEffect;
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
