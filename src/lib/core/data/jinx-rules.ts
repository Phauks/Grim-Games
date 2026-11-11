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
 * `nominated-partner`, `nominated-by-partner`,
 * `has-partner-ability`, `after-execution`, `final-day`, `{"day"}`, `{"night"}`,
 * `{"afterDay"}`, `{"marked"}`, `{"partnerMarked"}`, `{"alignment"}`, `{"partnerAlignment"}`,
 * a third character's `{"alive"}` and `{"inPlay"}`, and `{"not": <condition>}`. Each is
 * documented, with a worked example from a script entry, in `jinx-conditions.ts`.
 *
 * **What the app does.** Most verbs change what the app does: a picker, where a reminder
 * fits, an ability's state, a registration, a protection, a setup count, a step or a game end
 * (often with a night alert as well). These only tell the Storyteller, who applies them: a
 * night alert or a note on a step, never enforced: `storytellerChooses` with `player`,
 * `wakes`, `grimoire`, `noKill` with `token` or `killer`, every `learns` but `good-players`,
 * `partnerInPlay`, `arbitraryDeaths`, `guessesPartner`, `notShown` `given-ability`,
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
 *   Storyteller, `instead` happens: `a-minion`, a Minion holds it and learns this; `becomes`, a
 *   player becomes the partner, or with `type` up to `upTo` players (1 when left out) each
 *   become a character of that type; with `where: "demon-good-neighbour"` only one of the
 *   Demon's good neighbours may, under the token they were shown when the partner has a
 *   reminder for that (the Plague Doctor's Spy goes to a Minion, its Boomdandy to a player, its
 *   Marionette to a Demon's neighbour, and its Baron makes up to two Outsiders,
 *   https://wiki.bloodontheclocktower.com/Plague_Doctor#Related_Jinxes). Needs `givesAbility`;
 * - `noTurnGood`: a player the subject gives the partner's ability to (`givesAbility`), or
 *   turns from evil into the partner (`changesCharacter`), can't turn good by that ability: no
 *   change to good is offered and one made by hand warns (the Boffin's and the Pit-Hag's Cult
 *   Leader and Goon). Needs `givesAbility` or `changesCharacter`;
 * - `spareToken`: with a spare token, the subject may give or create the partner even while
 *   it is in play, so its picker offers it (the Boffin's and the Pit-Hag's Village Idiot).
 *   Needs `givesAbility` or `changesCharacter`;
 * - `storytellerChooses`: the Storyteller makes a choice the subject's players would make.
 *   `what: "player"`: the player the subject's part `via` picks. With `via: "changesCharacter"`
 *   (the default; its own, or the partner's with `has-partner-ability`), the Storyteller
 *   chooses which player it changes, and the subject's player only the character; with
 *   `creating: "partner"`, only when it makes the partner (the Pit-Hag's Damsel; with
 *   `partner-alive`, the Summoner while the Poppy Grower lives; with `has-partner-ability`, the
 *   Alchemist-Summoner). With `via: "carrierIsDemon"`, the Storyteller, not the players who
 *   wake for the subject, chooses who carries that token, a `storyteller-chooses` night alert
 *   at its step (with `partner-alive`, the Magician's Lil' Monsta,
 *   https://wiki.bloodontheclocktower.com/Magician#Related_Jinxes). Needs that `via` part.
 *   `what: "another-player"` (M44): when the subject's choice would land on the partner's
 *   player, the Storyteller chooses another player instead (a custom script's Widow who would
 *   poison its Lamplighter); faded and warned like `cannotChoose` (`jinx-redirect`), with a
 *   `storyteller-redirects` night alert. `what: "own-execution"`: while the subject's nominees
 *   nominate straight away (`nomineesNominate`), a nominated Storyteller is voted on instead:
 *   the Storyteller judges whether they are about to die, and executes them (the partner's
 *   `storyteller-executed` end) or the nominator nominates again (the Riot with the Atheist).
 *   Needs `nomineesNominate`;
 * - `wakes` (M46): how the players who wake together for the subject wake, `how:
 *   "one-by-one"`: singly, so they don't learn each other (for a `carrierIsDemon` token, until
 *   one chooses to take it), a `wakes-one-by-one` night alert at its step (with
 *   `partner-alive`, the Poppy Grower's Lil' Monsta,
 *   https://wiki.bloodontheclocktower.com/Poppy_Grower#Related_Jinxes);
 * - `alsoBecomes`: when the subject's `changesCharacter` makes a player the partner, players
 *   become a character of `type` too, named as `turnsPlayersInto` names them: with `players:
 *   "drafter"` (the default) that same player, as the partner is never dealt, chooses one and
 *   becomes it as well (the Hatter's Lil' Monsta,
 *   https://wiki.bloodontheclocktower.com/Hatter#Related_Jinxes); with `players:
 *   "neighbours"`, both their neighbours are of `type`: that player must neighbour one, and
 *   their other neighbour becomes an evil one of it (the Summoner's Lord of Typhon, a Minion,
 *   as the Lord of Typhon's own Minions sit). Needs `changesCharacter`;
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
 *   are sober). One about the subject's own player is a preset of a `patch` of the part
 *   `impairs` (`self.reason`, `data/jinx-presets.ts`, M61b);
 * - `noKill`: no kill from the subject tonight `on`: `token`, while the partner's own
 *   `stopsWaking` or `stopsKilling` token is on its player (the Exorcist's Chosen on the
 *   Yaggababble, the Princess's Doesn't Kill on the Al-Hadikhia; needs the partner's
 *   `stopsWaking` or `stopsKilling`, and is only worth writing where that token wouldn't stop
 *   the kill by itself); `chosen` (M44), the partner's player chose the subject's player
 *   tonight, marked by one of the partner's reminders placed on them tonight (`token`, or any
 *   of its own), with no kill-stopping token needed (a custom Lamplighter that chooses the
 *   Imp). Or, with `killer: "demon"` in place of `on`, no Demon kills tonight while `when`
 *   (required) holds for one subject's player (with `nominated-partner`, `partner-executed`
 *   and `partner-dead`, the Cannibal who nominated and executed the Princess today). `chosen`
 *   takes the kill off the step (`night-kill.ts`); each is a `no-kill` night alert;
 * - `protects` (M46): the character part `protects` for the subject's own player, while `when`
 *   holds: `from` and `night` as in that part (`from` is `any` when left out), and with `by:
 *   "partner"` only against the partner's kills (the Demon's kill when the partner is the
 *   Demon, or a death the partner's ability causes). A custom script's "The Gloom cannot kill
 *   the Lamplighter" is `{"who": "partner", "by": "partner"}` on the Gloom's entry. Read by
 *   `protectors` in `rules/protection.ts` with the part's own coverage, whatever any ability's
 *   state (a jinx is a rule, not an ability), and with `by` even against a kill that ignores
 *   protection: a `protected` night alert, no death;
 * - `grimoire`: what the subject's player sees of the Grimoire: `hides: "all"`, none of it
 *   while a partner's player has their ability (the Spy and the Widow with the Poppy Grower);
 *   a list, those tokens come off it first: `partner`, the partner's, and every token of each
 *   character type listed (with `partner-in-play`, the Spy's and the Widow's Magician and
 *   Demon);
 * - `endsGame`: a game end with the partner, worked out in `rules/jinx-ends.ts` (the
 *   Leviathan's and Riot's), its `when` checked at the moment of its event. A `condition`
 *   (M78) is built from parts: an `event` (`executed`, `day-ends`, `ability-used`), whose
 *   players it is about (`subject`: `self`, `partner`, or `marked`, the one carrying the
 *   partner's `token`), what must hold (`nominatedBySelf`, `died`, `noExecution`, `bothAlive`,
 *   `stops`, `day`, `alive`) and `winner`. The official kinds below are presets of it
 *   (`presetJinxEnd`), read into a `condition` with their name kept as `preset`:
 *   `nominated-marked-executed`, the subject's player nominates the player with the partner's
 *   `token` (optional: with none, the partner's own player) and they are executed, so `winner`
 *   wins; `marked-executed`, while the subject is in play the player with the partner's
 *   `token` (required) dies by execution; `executed` (M44), the subject's own player, or with
 *   `player: "partner"` the partner's, is executed, so `winner` wins, with no token and no
 *   nomination (a custom script's "if the Lamplighter is executed while the Saint lives, good
 *   wins", with `partner-alive` as it stood just before the execution);
 *   `day-without-execution`, the two players are alive when day `day` ends with no execution,
 *   in place of the subject's own end that day (`day` may be left out when `when` has
 *   `final-day`: then the latest day that ended); `ability-stopped` (M46), the partner's player
 *   may stop the subject's ability by day while it is active (with `nomineesNominate`, while
 *   its nominees nominate straight away; else while a subject's player lives), a day use with
 *   `stops`, so `winner` wins if exactly `alive` of the subject's players live, otherwise the
 *   other team (the Mayor stopping the riot); `gained-end` (M46), a subject's player with the
 *   partner's ability is under the partner's own game end `end` (`dead-without-demon`, the one
 *   a gained ability can carry), with `winner` (the Alchemist-Summoner); `night-instead` (M46),
 *   when the subject's `extra-day` end comes from the partner's Demon dying by execution, the
 *   extra day is a night instead, whose choice the `chooser`'s player makes (`partner`, the
 *   default, or `self`), a `jinx-night` hold with no `winner`: the chooser's own ability
 *   decides (the Mastermind with the Al-Hadikhia);
 * - `deadAtLeast`: the subject's `wakesWhen` dead count is met once `dead` players are dead
 *   (with `partner-in-play`, the King with the Leviathan or Riot). Needs `wakesWhen`. A preset
 *   of a `patch` of the part `wakesWhen` with `deadAtLeast` (`data/jinx-presets.ts`, M61d);
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
 *   Lamplighter's); `good-players` (M46), at Demon info, the subject's players wake in
 *   separate groups and each learns which players are good, never the partner's player, who
 *   is not shown as a Minion either (`who: "partner"` with `partner-in-play` in the
 *   Magician's file: Legion);
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
 * - `storytellerHas`: the Storyteller has the subject's ability `once`: `no-ability`, its living
 *   player has none (drunk, poisoned or without one), a `storyteller-has` night alert at its
 *   step (the Summoner with the Courtier and the Preacher); `changed`, the partner's
 *   `changesCharacter` changed its living player into another character
 *   (`storytellerAbilities`, the Summoner with the Engineer; needs the partner's
 *   `changesCharacter`);
 * - `arbitraryDeaths`: when the subject's `changesCharacter` makes a player a Demon while
 *   another living player is a Demon, deaths tonight are arbitrary, and its step says so (the
 *   Summoner with the Hatter, the Kazali and the Pit-Hag). Needs `changesCharacter`;
 * - `changesCharacter` (M46): the subject's own `changesCharacter` part, patched for creating
 *   the partner: with `token`, it may also make the partner, and only the partner, while its
 *   player carries that reminder of its own in place of the part's `token` (the Summoner's
 *   Pukka on Night 2). Read by the part's own reader (`characterChanger`, `earlyOnly`). Needs
 *   `changesCharacter`, with a `token`;
 * - `guessesPartner`: the subject's player may publicly guess a living player as the partner;
 *   if right, the Demon must choose the partner's player tonight, a `guessed` night alert at
 *   each Demon's step (with `self-alive` and `after-execution`, the Magician with the Wraith;
 *   with `has-partner-ability` too, the Alchemist-Spy, -Widow and -Wraith);
 * - `notShown` (M46): what isn't shown, `what`: `given-ability`, with the partner's ability,
 *   the ability the partner's `givesAbility` gave, to the subject's player (a `not-shown-given`
 *   night alert at the partner's step: the Alchemist-Boffin; needs the partner's
 *   `givesAbility`); `bluffs`, with the partner's ability, the bluffs the partner's `evilInfo`
 *   notes say it gets, to the subject's player, so those notes are left out (the
 *   Alchemist-Summoner); `partner-seat`, while the subject's player is alive, which of the
 *   Demon's neighbours is the partner's player, to the Demon at Demon info
 *   (`DemonInfo.neighbourHidden`: the Magician with the Marionette);
 * - `notSecondDemon`: the subject's `becomes` never makes a second Demon while another living
 *   player is the partner: the partner passing on by its own death (`death-passes`) doesn't
 *   make the subject's player the Demon too, and a player carrying its `becomes` token becomes
 *   the subject again (the Scarlet Woman with the Fang Gu and the Al-Hadikhia). Needs
 *   `becomes`;
 * - `keepsAbility` (M46): the partner's `keepsAbility` part, patched for the subject's dead
 *   player its token keeps: with `afterDeath`, they keep the ability after the token's own
 *   player dies too (the Mastermind with the Vigormortis). Read by the part's own reader
 *   (`keepsAbilityWhenDead`). Needs the partner's `keepsAbility`;
 * - `survives` (M46): a death the subject's player doesn't die, `on: "carrier-executed"`: the
 *   carrier of its `gameEnd.aliveWhileDead` token dying by execution; they live on with no
 *   ability (with `partner-alive`, the Lleech with the Mastermind). Needs `gameEnd`;
 * - `killsMarked`: the subject's kill (`deathCause.victim`) also kills the player carrying the
 *   partner's reminder `token` (the Slayer shooting the Lleech's host, "Poisoned");
 * - `madAsPartner`: the subject's `madness` may be about the partner, though the partner is
 *   not good: a `may-mad-as` night alert at its step (the Cerenovus with the Goblin). Needs
 *   `madness`. A preset of a `patch` of the part `madAs`, the partner among its `characters`
 *   (`data/jinx-presets.ts`, M61c);
 * - `thinksPartnerSetup`: while the subject's player thinks they are the partner (their seat
 *   shows the partner's token), the partner's own setup change applies as if it were in play
 *   (the Marionette who thinks they are the Balloonist or the Huntsman). Needs the partner's
 *   `setupModifier`;
 * - `voter` (M46): the subject's own `voter` part, patched while the partner's working
 *   `voting.secret` has votes cast with eyes closed: with `countsOnlyWith`, its player may
 *   raise their hand without their `onlyWith` player, but the vote counts only if that player
 *   voted too: no warning, the vote hint says so (the Butler with the Organ Grinder). Read by
 *   the part's own reader (`rules/vote-weights.ts`). Needs `voter`, and the partner's
 *   `voting`;
 * - `abnormalCounts`: the subject's `count` `among: "abnormal"` also counts a partner's player
 *   whose ability worked abnormally in a way the count leaves out, `counts`: `self-caused`,
 *   info recorded as abnormal because of the partner's own ability (the Mathematician with the
 *   Drunk and the Marionette); `unlike-demon`, the partner's `choosesLikeDemon` reminder is on
 *   none of the players a Demon killed tonight (the Mathematician with the Lunatic; needs the
 *   partner's `choosesLikeDemon`);
 * - `patch` (M61): `parts`, any parts of a character's rules block, used in place of the
 *   subject's own while the jinx is in effect and its `when` holds. Each is read by its own
 *   part reader, so a jinx can do whatever a character can: "while the Imp lives, the
 *   Lamplighter's vote counts twice" is `{"patch": {"parts": {"voteWeight": {"self": true,
 *   "weight": 2}}, "when": ["partner-alive"]}}`. Where the rules are read in the game
 *   (`rulesFor`).
 *
 * The prerequisites are `JINX_NEEDS`: this character's side is checked as the block is read
 * (`readJinxRules`, `jinx-read.ts`), the partner's once both are known (`jinxPartnerIssues`).
 */
import {
	CHARACTER_TYPES,
	type Alignment,
	type CharacterType,
	type ReminderLabel,
	type SeatedType
} from './types.ts';
import type { CharacterRules } from './character-rules.ts';
import type { JinxCondition } from './jinx-conditions.ts';
import type { PROTECTS_FROM } from './parts/protects.ts';
import type { TurnsPlayers } from './turns-players-rules.ts';

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

export const GIVEN_INSTEAD = ['a-minion', 'becomes'] as const;
export type GivenInsteadKind = (typeof GIVEN_INSTEAD)[number];
export const GIVEN_WHERE = ['demon-good-neighbour'] as const;

export interface GivenInsteadRule extends JinxEffect {
	instead: GivenInsteadKind;
	/** With `becomes`: players become characters of this type, not the partner. */
	type?: CharacterType;
	/** With `becomes`: how many players may, 1 when left out. */
	upTo?: number;
	/** With `becomes`: only these players may (a Demon's good neighbour). */
	where?: (typeof GIVEN_WHERE)[number];
}

/** What happens in place of the Storyteller gaining an ability (`givenInstead()`). */
export type GivenInstead = Omit<GivenInsteadRule, 'who' | 'when'>;

export const STORYTELLER_CHOOSES = ['player', 'another-player', 'own-execution'] as const;
export const CHOOSES_VIA = ['changesCharacter', 'carrierIsDemon'] as const;

export interface StorytellerChooses extends JinxEffect {
	/**
	 * `player`: whom the subject's `via` picks; `another-player`: whom the subject's choice
	 * lands on, when it would be the partner's player; `own-execution`: whether a nominated
	 * Storyteller would be executed.
	 */
	what: (typeof STORYTELLER_CHOOSES)[number];
	/** With `player` only: `changesCharacter` when left out. */
	via?: (typeof CHOOSES_VIA)[number];
	/** With `player` by `changesCharacter` only. */
	creating?: 'partner';
}

/** Whether a `storytellerChooses` is about whom `changesCharacter` changes. */
export const choosesChanged = (e: StorytellerChooses | undefined): boolean =>
	e?.what === 'player' && (e.via ?? 'changesCharacter') === 'changesCharacter';

export interface Wakes extends JinxEffect {
	how: 'one-by-one';
}

/**
 * An `alsoBecomes` entry: who else becomes a character of `type`, in the words of
 * `turnsPlayersInto` (P12): the player made the partner (`drafter`, the default, left out), or
 * with `players: "neighbours"` both their neighbours.
 */
export interface TypeEffect extends JinxEffect {
	type: SeatedType;
	players?: Extract<TurnsPlayers, 'neighbours'>;
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

export const NO_KILL_TRIGGERS = ['token', 'chosen'] as const;
export type NoKillTrigger = (typeof NO_KILL_TRIGGERS)[number];

export interface NoKill extends JinxEffect {
	/** What stops the subject's kill; left out with `killer`. */
	on?: NoKillTrigger;
	/** In place of `on`: every Demon's kill stops while `when` holds. */
	killer?: 'demon';
	/** With `chosen` only: the partner's reminder that marks its choice; any of them without. */
	token?: ReminderLabel;
}

/** A jinx `protects`: the character part's coverage, for the subject's own player. */
export interface JinxProtects extends JinxEffect {
	from: (typeof PROTECTS_FROM)[number];
	night?: true;
	/** Only against the partner's kills. */
	by?: 'partner';
}

/** A hidden Grimoire token: the partner's, or every token of a character type. */
export type GrimoireHidden = 'partner' | CharacterType;
export const GRIMOIRE_HIDDEN: readonly GrimoireHidden[] = ['partner', ...CHARACTER_TYPES];

export interface GrimoireRule extends JinxEffect {
	hides: 'all' | readonly GrimoireHidden[];
}

export const JINX_END_KINDS = [
	'condition',
	'nominated-marked-executed',
	'marked-executed',
	'day-without-execution',
	'ability-stopped',
	'gained-end',
	'night-instead',
	'executed'
] as const;
export type JinxEndKind = (typeof JINX_END_KINDS)[number];
/** The official end kinds that are presets of a `condition` (`presetJinxEnd`). */
export const JINX_END_PRESETS = [
	'nominated-marked-executed',
	'marked-executed',
	'day-without-execution',
	'ability-stopped',
	'executed'
] as const;
export type JinxEndPreset = (typeof JINX_END_PRESETS)[number];
/** What a jinx `condition` end waits for. */
export const JINX_END_EVENTS = ['executed', 'day-ends', 'ability-used'] as const;
/** Whose players a jinx `condition` end is about: its own, the partner's, or the partner's `token`'s. */
export const JINX_END_SUBJECTS = ['self', 'partner', 'marked'] as const;
/** The partner's own game ends a `gained-end` may carry to a player with its ability. */
export const GAINED_ENDS = ['dead-without-demon'] as const;

/** An `endsGame` entry: how the game ends with the partner, and who wins. */
export interface JinxEnd extends JinxEffect {
	kind: JinxEndKind;
	/** Who wins; `night-instead` has none, the chooser's ability decides. */
	winner?: Alignment;
	/** The partner's own end (`gained-end`). */
	end?: (typeof GAINED_ENDS)[number];
	/** Whose player makes the night's choice (`night-instead`): the partner's, the default, or the subject's. */
	chooser?: JinxWho;
	/** One of the partner's reminders, on the player it is about. */
	token?: ReminderLabel;
	/** The day whose end it is checked at (`day-without-execution`). */
	day?: number;
	/** How many of the subject's players alive give `winner` the game (`ability-stopped`). */
	alive?: number;
	/** Whose player's execution ends it (`executed`): the subject's, the default, or the partner's. */
	player?: JinxWho;
	/** The official kind a `condition` was written as. */
	preset?: JinxEndPreset;
	/** For a `condition`: what it waits for. */
	event?: (typeof JINX_END_EVENTS)[number];
	/** For a `condition`: whose players it is about (`marked`: the one carrying `token`). */
	subject?: (typeof JINX_END_SUBJECTS)[number];
	/** For `executed`: the subject's own player nominated them. */
	nominatedBySelf?: true;
	/** For `executed`: the player died of it, whenever it was, logged or not (the Grandchild). */
	died?: true;
	/** For `day-ends`: only a day with no execution. */
	noExecution?: true;
	/** For `day-ends`: both its and the partner's players are alive; it replaces its own end that day. */
	bothAlive?: true;
	/** For `ability-used`: the use stops its ability (`stops`). */
	stops?: true;
}

/** A jinx end of an official kind as the `condition` it is a preset of. */
export function presetJinxEnd(end: JinxEnd): JinxEnd {
	const { kind, ...rest } = end;
	const base = { ...rest, kind: 'condition' as const };
	switch (kind) {
		case 'nominated-marked-executed':
			return {
				...base,
				preset: kind,
				event: 'executed',
				subject: end.token ? 'marked' : 'partner',
				nominatedBySelf: true
			};
		case 'marked-executed':
			return { ...base, preset: kind, event: 'executed', subject: 'marked', died: true };
		case 'executed': {
			const { player, ...own } = base;
			return { ...own, preset: kind, event: 'executed', subject: player ?? 'self' };
		}
		case 'day-without-execution':
			return { ...base, preset: kind, event: 'day-ends', noExecution: true, bothAlive: true };
		case 'ability-stopped':
			return { ...base, preset: kind, event: 'ability-used', subject: 'partner', stops: true };
		default:
			return end;
	}
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
	'character',
	'good-players'
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

export const STORYTELLER_HAS = ['no-ability', 'changed'] as const;
export type StorytellerHasOnce = (typeof STORYTELLER_HAS)[number];

export interface StorytellerHas extends JinxEffect {
	once: StorytellerHasOnce;
}

/** An effect whose parameter is a reminder (`killsMarked`, `changesCharacter`). */
export interface TokenEffect extends JinxEffect {
	token: ReminderLabel;
}

export const NOT_SHOWN = ['given-ability', 'bluffs', 'partner-seat'] as const;

export interface NotShown extends JinxEffect {
	what: (typeof NOT_SHOWN)[number];
}

export interface KeepsAbilityPatch extends JinxEffect {
	afterDeath: true;
}

export interface Survives extends JinxEffect {
	on: 'carrier-executed';
}

export interface VoterPatch extends JinxEffect {
	countsOnlyWith: true;
}

export const ABNORMAL_COUNTS = ['self-caused', 'unlike-demon'] as const;
export type AbnormalCounts = (typeof ABNORMAL_COUNTS)[number];

export interface AbnormalCountsRule extends JinxEffect {
	counts: AbnormalCounts;
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
	wakes?: Wakes;
	alsoBecomes?: TypeEffect;
	carriedBy?: CarriedBy;
	diesWhenExecuted?: JinxEffect;
	registersTo?: RegistersTo;
	impairs?: Impairs;
	noKill?: NoKill;
	protects?: JinxProtects;
	grimoire?: GrimoireRule;
	endsGame?: JinxEnd;
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
	storytellerHas?: StorytellerHas;
	arbitraryDeaths?: JinxEffect;
	changesCharacter?: TokenEffect;
	guessesPartner?: JinxEffect;
	notShown?: NotShown;
	notSecondDemon?: JinxEffect;
	keepsAbility?: KeepsAbilityPatch;
	survives?: Survives;
	killsMarked?: TokenEffect;
	madAsPartner?: JinxEffect;
	thinksPartnerSetup?: JinxEffect;
	voter?: VoterPatch;
	abnormalCounts?: AbnormalCountsRule;
	patch?: JinxPatch;
}

/**
 * Parts of the subject's own rules block, in place of its own while the jinx is in effect and
 * its `when` holds (M61, `rules/rules-for.ts`). Each is read by its part's own reader.
 */
export interface JinxPatch extends JinxEffect {
	parts: CharacterRules;
	/** The older verb this patch was read from (`impairs`), when it was one (M61b). */
	preset?: JinxPresetVerb;
}

/**
 * The verbs read as a {@link JinxPatch} (M61b, M61c): `impairs` about the subject's own
 * player, `madAsPartner` (the part `madAs` with the partner among its `characters`),
 * `deadAtLeast` (the part `wakesWhen` with `deadAtLeast`).
 */
export type JinxPresetVerb = 'impairs' | 'madAsPartner' | 'deadAtLeast';

export type JinxRuleKey = keyof JinxRules;
