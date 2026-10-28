/**
 * A character's rules as data: one `rules` block per character (Trevor, 2026-10-22, plan B;
 * behaviours with parameters, option 1). Official characters get theirs from our overlay file
 * `rules/<id>.json`, because TPI's `roles.json` stays untouched; a custom character
 * carries the same block as `rules` in its own script entry. Both are read by
 * `parseCharacterRules`, so a custom character can do anything an official one can.
 *
 * Each key is one behaviour the rules code knows, and names no character. The tables still in
 * TypeScript move here one per PR (the list is in docs/shared-components.md).
 * Design: /mnt/project-files/character-changes/option-1-parameters-spike.md.
 */
import { readSetupModifier, type SetupModifierRules } from './setup-modifier-rules.ts';
import { readDayReminders, type DayReminderRules } from './day-reminder-rules.ts';
import { readAfterDeath, type AfterDeath } from './after-death-rules.ts';
import { readDeathCause, type DeathCauseRule } from './death-cause-rules.ts';
import { readNightText, type NightTextRules } from './night-text-rules.ts';
import { readDayMark, type DayMarkRule } from './day-mark-rules.ts';
import { readInfoTokenCharacters, type InfoTokenCharacterRules } from './info-token-rules.ts';
import { readStopsWaking, type StopsWaking } from './stops-waking-rules.ts';
import { readWakesWhen, type WakesWhen } from './wakes-when-rules.ts';
import { CHOICE_RULE_KEYS, readChoiceRules, type ChoiceRules } from './choice-rules.ts';
import { readRegistersAs } from './registers-as-rules.ts';
import { readKeepsAbility, type KeepsAbility } from './keeps-ability-rules.ts';
import { readBecomes, readMakesDemon, type Becomes, type MakesDemon } from './becomes-rules.ts';
import { ownReminder, readToken } from './reminder-fields.ts';
import { readImpairs, type Impairs } from './impairs-rules.ts';
import { readReminderMovement, type ReminderMovementRules } from './reminder-movement-rules.ts';
import {
	readReminderPlaceholders,
	type ReminderPlaceholderRules
} from './reminder-placeholder-rules.ts';
import { readSetupPrep, type SetupPrepRules } from './setup-prep-rules.ts';
import { readGameEnd, type GameEndRules } from './game-end-rules.ts';
import { readReminderTargets, readTypes, type TargetRule } from './target-rules.ts';
import { readTurnsPlayersInto, type TurnsPlayersInto } from './turns-players-rules.ts';
import {
	ALIGNMENTS,
	CHARACTER_TYPES,
	type Alignment,
	SEATED_TYPES,
	type CharacterId,
	type CharacterType,
	type ReminderLabel,
	type SeatedType
} from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readNumber,
	readString,
	type Issues
} from './validate.ts';

/** The question placing a reminder asks: mark the living seat dead, or revive a dead one. */
const REMINDER_PROMPTS = ['markDead', 'revive'] as const;
export type ReminderPrompt = (typeof REMINDER_PROMPTS)[number];

/** Who did the killing: the Demon's kill, another ability's, or either. */
const KILLED_BY = ['demon', 'other', 'any'] as const;
export type KilledBy = (typeof KILLED_BY)[number];

/** What being nominated sets off: the nominator is executed straight away. */
const NOMINATED_EFFECTS = ['execute-nominator'] as const;
export type NominatedEffect = (typeof NOMINATED_EFFECTS)[number];

/**
 * What a player says in town that the day log keeps for their ability (Trevor, 2026-10-23:
 * L56, "these all relate to specific announcements in town by players"): seat and character
 * guesses, one statement that is true or false, or two statements.
 */
const DAY_CLAIMS = ['guesses', 'statement', 'statements'] as const;
export type DayClaim = (typeof DAY_CLAIMS)[number];

/**
 * Night deaths the ability itself decides (`rules/night-deaths.ts`):
 * - `wrong-guess`: the player guesses a player's character and dies if wrong (the Gambler);
 * - `chose-impaired`: the player dies if their pick is drunk or poisoned (the Acrobat);
 * - `chosen-good-dies`: a chosen good player dies and the Demon does not kill (the Lycanthrope);
 * - `marked-killed-by-demon`: the player dies when the Demon kills whoever carries `token`
 *   (the Grandmother's Grandchild).
 */
const DEATH_CHECK_KINDS = [
	'wrong-guess',
	'chose-impaired',
	'chosen-good-dies',
	'marked-killed-by-demon'
] as const;
export type DeathCheckKind = (typeof DEATH_CHECK_KINDS)[number];
export interface DeathCheckRule {
	kind: DeathCheckKind;
	token?: ReminderLabel;
}

export interface CharacterRules extends ChoiceRules {
	/** Reminders whose placing is the moment to change the seat's state, by label. */
	reminderPrompts?: Readonly<Record<ReminderLabel, ReminderPrompt>>;
	/**
	 * The ability still acts once its player is dead: it triggers on their death ("When you
	 * die", "If you died today or tonight") or works "even if dead". Its reminders stay with
	 * the living ones in the reminder bank.
	 */
	actsWhenDead?: boolean;
	/**
	 * The ability is set off by its player's death, by `by` (the Ravenkeeper, the Sage); with
	 * `night`, only a death at night, never an execution (the Ravenkeeper's "if you die at night").
	 */
	onDeath?: { by: KilledBy; night?: true };
	/**
	 * The ability stops a death: its own player's (`self`, the Soldier), the player marked
	 * with its `token` (the Monk's "Safe") or any good player's (`good`, the Pacifist), against
	 * the Demon's kill only, any kill, or an execution only.
	 */
	protects?: Protects;
	/** A kill on its player, by `from`, may land on another player instead (the Mayor). */
	redirectsKill?: { from: (typeof PROTECTS_FROM)[number] };
	/**
	 * Its player's first death does not happen; placing `spentToken`, one of its reminders,
	 * marks the ability used (the Fool's "No Ability").
	 */
	survivesFirstDeath?: { spentToken: ReminderLabel };
	/**
	 * The first time its player is nominated by a `by` character, `effect` happens (the
	 * Virgin). Once used, the character's "No Ability" reminder marks it spent.
	 */
	onNominated?: { by: CharacterType; effect: NominatedEffect };
	/**
	 * What its player may still do once dead, when the death's `cause` is one of these ('demon'
	 * also matches any Demon's id; an unrecorded cause counts): nominate `nominations` times a
	 * day, and vote `votes` times on every nomination without a vote token. Dead players may not
	 * nominate otherwise and have one ghost vote (https://wiki.bloodontheclocktower.com/Glossary,
	 * "Nomination", "Dead Player"); the Banshee killed by the Demon nominates and votes twice
	 * (https://wiki.bloodontheclocktower.com/Banshee).
	 */
	afterDeath?: AfterDeath;
	/**
	 * Its player may make this many more nominations each day after the day's first execution,
	 * even if they already nominated, and of a player already nominated today (the Butcher,
	 * https://wiki.bloodontheclocktower.com/Butcher).
	 */
	nominationsAfterExecution?: number;
	/**
	 * The ability kills at night: the Demon's kill or another ability's (`by`), any player or
	 * only its own (`targets: self`, the Gambler), and ignoring protection (the Assassin).
	 */
	kills?: Kills;
	/** Where each of its reminder tokens may go, by label (`target-rules.ts`). */
	reminderTargets?: Readonly<Record<ReminderLabel, TargetRule>>;
	/** First-night information the Storyteller picks from the truthful options (the Chef). */
	learns?: Learns;
	/** A night answer worked out from the grimoire and today's log (the Town Crier). */
	answers?: Answers;
	/** The claim its player makes by day, logged from their day row and seat ⋯ menu (L56). */
	dayClaim?: DayClaim;
	/** At most this many guesses a day, for a `guesses` claim (the Juggler's 5). */
	guessLimit?: number;
	/** How the ability leaves players drunk, poisoned or with no ability (`rules/ability.ts`). */
	impairs?: Impairs;
	/** Players who may register as another alignment or character type (`rules/ability.ts`). */
	registersAs?: RegistersAs;
	/** How the ability ends the game, keeps it going, or changes who wins (`rules/game-end.ts`). */
	gameEnd?: GameEndRules;
	/** A night death its own ability decides (`rules/night-deaths.ts`). */
	deathCheck?: DeathCheckRule;
	/** Tokens and steps to prepare before the first night (`rules/setup-reminders.ts`). */
	setupPrep?: SetupPrepRules;
	/** How its [bracketed] text changes which characters are dealt (`rules/setup-modifiers.ts`). */
	setupModifier?: SetupModifierRules;
	/** What to watch for during the day because of it (`rules/day-reminders.ts`). */
	dayReminders?: DayReminderRules;
	/** Whether and how its ability can cause a death (`rules/death-causes.ts`). */
	deathCause?: DeathCauseRule;
	/** Which of its reminder tokens stay where they were placed (`rules/reminder-movement.ts`). */
	reminderMovement?: ReminderMovementRules;
	/** What each `:reminder:` in its night text means (`rules/night-text.ts`). */
	reminderPlaceholders?: ReminderPlaceholderRules;
	/** Our own night text in place of the original (`rules/night-text.ts`). */
	nightText?: NightTextRules;
	/** A fact about today the Storyteller marks for its night answer (`rules/day-marks.ts`). */
	dayMark?: DayMarkRule;
	/** Its token on a player stops them waking tonight (`stops-waking-rules.ts`). */
	stopsWaking?: StopsWaking;
	/** Its token on a player stops them killing tonight (`stops-waking-rules.ts`'s shape). */
	stopsKilling?: StopsWaking;
	/** A condition its player needs before waking for it (`wakes-when-rules.ts`). */
	wakesWhen?: WakesWhen;
	/** Its token on a dead player keeps that player's ability (`keeps-ability-rules.ts`). */
	keepsAbility?: KeepsAbility;
	/** Its token says a player changed character or alignment (`becomes-rules.ts`). */
	becomes?: Becomes;
	/** On a night its token marks, it makes a chosen player a Demon (`becomes-rules.ts`). */
	makesDemon?: MakesDemon;
	/** The characters its night step's info tokens show, filled in (`rules/info-token-characters.ts`). */
	infoTokenCharacters?: InfoTokenCharacterRules;
	/**
	 * The ability can make an extra evil player: turn a good player evil or bring one more evil
	 * player in, as the Spirit of Ivory limits (https://wiki.bloodontheclocktower.com/Spirit_of_Ivory).
	 * Sushi Buffet's Ivory draft drafts at most one such character (`modes/draft.ts`).
	 */
	makesExtraEvil?: boolean;
	/**
	 * Its ability is only the jinxes, which show on their own, so a game never starts with it in
	 * play (the Djinn, https://wiki.bloodontheclocktower.com/Djinn; Trevor, 2026-10-17).
	 */
	jinxesOnly?: boolean;
	/**
	 * A hidden character (one with no token of its own, such as the Drunk) the Storyteller may
	 * make this character's player instead, who then thinks they are this character. Sushi
	 * Buffet asks when it is drafted, as Grimbits' draft tool does for the Atheist
	 * (https://grimbits.com/draft-buffet/; `modes/draft.ts`).
	 */
	orHiddenAs?: CharacterId;
	/**
	 * Its player has the ability of a not-in-play character of this type, so that character's
	 * setup change applies too: the Alchemist's Minion ability
	 * (https://wiki.bloodontheclocktower.com/Alchemist). Sushi Buffet asks which when it is
	 * drafted, or later, as Grimbits' draft tool does (`modes/draft.ts`).
	 */
	gainsAbilityOf?: SeatedType;
	/** Players it turns into another type at setup (the Kazali; `turns-players-rules.ts`). */
	turnsPlayersInto?: TurnsPlayersInto;
}

/** What a player may also register as, besides their true alignment and character type. */
export interface Registers {
	alignments?: readonly Alignment[];
	types?: readonly CharacterType[];
}

/**
 * Who may register as something else while this character's ability works: `self`, its own
 * player, even if dead (the Spy as good and a Townsfolk or Outsider, the Recluse as evil and a
 * Minion or Demon); `tokens`, the player carrying one of its reminders, by label, only while
 * their alignment is `carrierAlignment` when given (the Lycanthrope's "Faux Paw" on a good
 * player, as evil; `TokenRegisters`). A Fabled's tokens work while it is in play.
 */
export interface RegistersAs {
	self?: Registers;
	tokens?: Readonly<Record<ReminderLabel, TokenRegisters>>;
}

/**
 * A `registersAs.tokens` entry. `asAnything`: the carrier may register as either alignment and
 * any seated character type, its true ones first; `whileToken`: only while another of this
 * character's reminders is still in play (the Revolutionary's pair, each "Aligned", may
 * register falsely until "Register Falsely?" comes off,
 * https://wiki.bloodontheclocktower.com/Revolutionary).
 */
export type TokenRegisters = Registers & {
	carrierAlignment?: Alignment;
	asAnything?: true;
	whileToken?: ReminderLabel;
};

/**
 * What a `learns` character is shown, each worked out in `rules/night-info.ts`:
 * - `pair-of-type`: two players, one of them a `type` character, shown which (Washerwoman);
 *   `noneWhenAbsent` lets it learn there are none (Librarian);
 * - `evil-pairs`: pairs of evil neighbours (Chef);
 * - `evil-alive-neighbours`: evil among the two alive neighbours (Empath);
 * - `demon-minion-steps`: steps from the Demon to its nearest Minion (Clockmaker);
 * - `demon-or-token`: yes if either of two chosen players is the Demon or carries `token`
 *   (Fortune Teller's Red Herring);
 * - `good-player`: one good player (Steward);
 * - `one-evil-of-three`: three players, exactly one evil (Noble);
 * - `same-alignment`: yes if two chosen players are the same alignment (Seamstress);
 * - `demon-in-pair`: two players, one of them the Demon (Sage);
 * - `character-of`: one player's character (Ravenkeeper, King, Pixie, Grandmother), from the
 *   other players unless `self`, only `alive` ones, of `types` and `alignment` when given;
 * - `not-demon-pair`: two players, neither the Demon (Knight);
 * - `evil-player`: one evil player (Bounty Hunter);
 * - `demon-player`: the Demon's player (Choirboy).
 * `reminders` are the tokens to place: `target` on the shown character's player, `other` on the
 * second player, `each` on every player tapped.
 */
const LEARNS_MEASURES = [
	'pair-of-type',
	'evil-pairs',
	'evil-alive-neighbours',
	'demon-minion-steps',
	'demon-or-token',
	'good-player',
	'one-evil-of-three',
	'same-alignment',
	'demon-in-pair',
	'character-of',
	'not-demon-pair',
	'evil-player',
	'demon-player'
] as const;
export interface Learns {
	measure: (typeof LEARNS_MEASURES)[number];
	type?: CharacterType;
	token?: ReminderLabel;
	noneWhenAbsent?: boolean;
	/** For `character-of`: the waking player may be the one (the Ravenkeeper "any player"). */
	self?: true;
	/** For `character-of`: only alive players (the King's "alive character"). */
	alive?: true;
	/** For `character-of`: only players of these types, or of this alignment. */
	types?: readonly CharacterType[];
	alignment?: Alignment;
	reminders?: { target?: ReminderLabel; other?: ReminderLabel; each?: ReminderLabel };
}

/**
 * What an `answers` character learns, each worked out in `rules/night-info.ts`:
 * `minion-nominated` (Town Crier), `demon-voted` (Flowergirl), `executed-character`
 * (Undertaker), `outsider-died` (Godfather), `correct-guesses` (Juggler), `evil-dead`
 * (Oracle), `abnormal-abilities` (Mathematician), `statement-true` (Gossip, from the
 * statement logged by day, L58), `outsiders-in-play` (the Outsider characters in play).
 * `token` is the character's reminder that marks the answer on the board ("Died Today",
 * "Abnormal"). `firstNight` is the question asked on the first night instead, for a
 * character that learns something else then (the Godfather starts knowing which Outsiders
 * are in play, https://wiki.bloodontheclocktower.com/Godfather).
 */
const ANSWER_QUESTIONS = [
	'minion-nominated',
	'demon-voted',
	'executed-character',
	'outsider-died',
	'correct-guesses',
	'evil-dead',
	'abnormal-abilities',
	'statement-true',
	'outsiders-in-play'
] as const;
export interface Answers {
	question: (typeof ANSWER_QUESTIONS)[number];
	token?: ReminderLabel;
	firstNight?: (typeof ANSWER_QUESTIONS)[number];
}

const KILLS_BY = ['demon', 'other'] as const;
const KILLS_TARGETS = ['any', 'self'] as const;
export interface Kills {
	by: (typeof KILLS_BY)[number];
	targets?: (typeof KILLS_TARGETS)[number];
	ignoresProtection?: boolean;
}

const PROTECTS_WHO = ['self', 'marked', 'good'] as const;
/**
 * What a protection stops: the Demon's kill, any death, only an execution (the Devil's
 * Advocate's, https://wiki.bloodontheclocktower.com/Devil%27s_Advocate), any death but an
 * execution (the Storm Catcher's good character "can only die by execution",
 * https://wiki.bloodontheclocktower.com/Storm_Catcher), or any death by day, an execution
 * included (the Vizier "cannot die during the day",
 * https://wiki.bloodontheclocktower.com/Vizier).
 */
export const PROTECTS_FROM = ['demon', 'any', 'execution', 'not-execution', 'day'] as const;
/**
 * `night`: it lasts only the night it is given ("can't die tonight"), so never stops an
 * execution. `storytellerDecides`: the player only "might not die" (the Pacifist, the
 * Psychopath's roshambo), so the grimoire never applies it; the Storyteller picks it in the
 * Execution sheet's Saved by. `whileNeighboursGood`: it holds only while both of the
 * character's alive neighbours are good (the Tea Lady,
 * https://wiki.bloodontheclocktower.com/Tea_Lady).
 */
export type Protects = (
	| { who: 'self' | 'good'; from: (typeof PROTECTS_FROM)[number] }
	| { who: 'marked'; token: ReminderLabel; from: (typeof PROTECTS_FROM)[number] }
) & { night?: true; storytellerDecides?: true; whileNeighboursGood?: true };

export { type ImpairmentReason, type Impairs, type TokenImpairment } from './impairs-rules.ts';

/** Every key a rules block may have; one more per migrated table. */
const RULE_KEYS = [
	'reminderPrompts',
	'actsWhenDead',
	'onDeath',
	'protects',
	'redirectsKill',
	'survivesFirstDeath',
	'kills',
	'reminderTargets',
	'learns',
	'answers',
	'onNominated',
	'afterDeath',
	'nominationsAfterExecution',
	'dayClaim',
	'guessLimit',
	'impairs',
	'registersAs',
	'gameEnd',
	'deathCheck',
	'setupPrep',
	'setupModifier',
	'dayReminders',
	'deathCause',
	'reminderMovement',
	'reminderPlaceholders',
	'nightText',
	'dayMark',
	'stopsWaking',
	'stopsKilling',
	'wakesWhen',
	'keepsAbility',
	'becomes',
	'makesDemon',
	'infoTokenCharacters',
	'makesExtraEvil',
	'jinxesOnly',
	'orHiddenAs',
	'gainsAbilityOf',
	'turnsPlayersInto',
	...CHOICE_RULE_KEYS
] as const satisfies readonly (keyof CharacterRules)[];

/**
 * Reads a rules block, recording each problem in `issues` with its path. `reminders`, when
 * given, are the character's own reminder labels: a rule about a reminder it lacks is an error.
 * Our overlay files are checked against `roles.json` by their tests instead.
 */
export function parseCharacterRules(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders?: readonly ReminderLabel[]
): CharacterRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const before = issues.list.length;
	const rules: CharacterRules = {};
	for (const key of Object.keys(raw)) {
		if (!(RULE_KEYS as readonly string[]).includes(key))
			issues.add(`${path}.${key}`, 'unknown rule');
	}
	if (raw.reminderPrompts !== undefined) {
		const prompts = readPrompts(raw.reminderPrompts, `${path}.reminderPrompts`, issues, reminders);
		if (prompts) rules.reminderPrompts = prompts;
	}
	const actsWhenDead = readBoolean(raw, 'actsWhenDead', path, issues);
	if (actsWhenDead !== undefined) rules.actsWhenDead = actsWhenDead;
	if (raw.onDeath !== undefined) {
		if (!isObject(raw.onDeath)) {
			issues.add(`${path}.onDeath`, `expected object, got ${describe(raw.onDeath)}`);
		} else {
			checkKeys(raw.onDeath, ['by', 'night'], `${path}.onDeath`, issues);
			const by = readEnum(raw.onDeath, 'by', KILLED_BY, `${path}.onDeath`, issues, true);
			const night = readBoolean(raw.onDeath, 'night', `${path}.onDeath`, issues);
			if (by) rules.onDeath = night ? { by, night } : { by };
		}
	}
	if (raw.redirectsKill !== undefined) {
		const at = `${path}.redirectsKill`;
		if (!isObject(raw.redirectsKill)) {
			issues.add(at, `expected object, got ${describe(raw.redirectsKill)}`);
		} else {
			checkKeys(raw.redirectsKill, ['from'], at, issues);
			const from = readEnum(raw.redirectsKill, 'from', PROTECTS_FROM, at, issues, true);
			if (from) rules.redirectsKill = { from };
		}
	}
	if (raw.survivesFirstDeath !== undefined) {
		const at = `${path}.survivesFirstDeath`;
		if (!isObject(raw.survivesFirstDeath)) {
			issues.add(at, `expected object, got ${describe(raw.survivesFirstDeath)}`);
		} else {
			checkKeys(raw.survivesFirstDeath, ['spentToken'], at, issues);
			const token = readString(raw.survivesFirstDeath, 'spentToken', at, issues, true);
			if (token !== undefined && !ownReminder(token, reminders)) {
				issues.add(`${at}.spentToken`, 'not one of this character’s reminders');
			} else if (token !== undefined) rules.survivesFirstDeath = { spentToken: token };
		}
	}
	if (raw.learns !== undefined) {
		const learns = readLearns(raw.learns, `${path}.learns`, issues, reminders);
		if (learns) rules.learns = learns;
	}
	if (raw.answers !== undefined) {
		const at = `${path}.answers`;
		if (!isObject(raw.answers)) {
			issues.add(at, `expected object, got ${describe(raw.answers)}`);
		} else {
			checkKeys(raw.answers, ['question', 'token', 'firstNight'], at, issues);
			const question = readEnum(raw.answers, 'question', ANSWER_QUESTIONS, at, issues, true);
			const token = readToken(raw.answers, 'token', at, issues, reminders);
			const firstNight = readEnum(raw.answers, 'firstNight', ANSWER_QUESTIONS, at, issues, false);
			if (question) {
				rules.answers = {
					question,
					...(token ? { token } : {}),
					...(firstNight ? { firstNight } : {})
				};
			}
		}
	}
	if (raw.reminderTargets !== undefined) {
		const targets = readReminderTargets(
			raw.reminderTargets,
			`${path}.reminderTargets`,
			issues,
			reminders
		);
		if (targets) rules.reminderTargets = targets;
	}
	if (raw.kills !== undefined) {
		const at = `${path}.kills`;
		if (!isObject(raw.kills)) {
			issues.add(at, `expected object, got ${describe(raw.kills)}`);
		} else {
			checkKeys(raw.kills, ['by', 'targets', 'ignoresProtection'], at, issues);
			const by = readEnum(raw.kills, 'by', KILLS_BY, at, issues, true);
			const targets = readEnum(raw.kills, 'targets', KILLS_TARGETS, at, issues, false);
			const ignoresProtection = readBoolean(raw.kills, 'ignoresProtection', at, issues);
			if (by) {
				rules.kills = { by };
				if (targets) rules.kills.targets = targets;
				if (ignoresProtection !== undefined) rules.kills.ignoresProtection = ignoresProtection;
			}
		}
	}
	if (raw.protects !== undefined) {
		const protects = readProtects(raw.protects, `${path}.protects`, issues, reminders);
		if (protects) rules.protects = protects;
	}
	if (raw.onNominated !== undefined) {
		const at = `${path}.onNominated`;
		if (!isObject(raw.onNominated)) {
			issues.add(at, `expected object, got ${describe(raw.onNominated)}`);
		} else {
			checkKeys(raw.onNominated, ['by', 'effect'], at, issues);
			const by = readEnum(raw.onNominated, 'by', CHARACTER_TYPES, at, issues, true);
			const effect = readEnum(raw.onNominated, 'effect', NOMINATED_EFFECTS, at, issues, true);
			if (by && effect) rules.onNominated = { by, effect };
		}
	}
	const afterExecution = readNumber(raw, 'nominationsAfterExecution', path, issues);
	if (afterExecution !== undefined) {
		if (!Number.isInteger(afterExecution) || afterExecution < 1)
			issues.add(`${path}.nominationsAfterExecution`, 'expected a whole number, 1 or more');
		else rules.nominationsAfterExecution = afterExecution;
	}
	if (raw.afterDeath !== undefined) {
		const afterDeath = readAfterDeath(raw.afterDeath, `${path}.afterDeath`, issues);
		if (afterDeath) rules.afterDeath = afterDeath;
	}
	const dayClaim = readEnum(raw, 'dayClaim', DAY_CLAIMS, path, issues, false);
	if (dayClaim) rules.dayClaim = dayClaim;
	const guessLimit = readNumber(raw, 'guessLimit', path, issues);
	if (guessLimit !== undefined) {
		if (Number.isInteger(guessLimit) && guessLimit > 0) rules.guessLimit = guessLimit;
		else issues.add(`${path}.guessLimit`, `expected a whole number above 0, got ${guessLimit}`);
	}
	if (raw.impairs !== undefined) {
		const impairs = readImpairs(raw.impairs, `${path}.impairs`, issues, reminders);
		if (impairs) rules.impairs = impairs;
	}
	if (raw.registersAs !== undefined) {
		const registersAs = readRegistersAs(raw.registersAs, `${path}.registersAs`, issues, reminders);
		if (registersAs) rules.registersAs = registersAs;
	}
	if (raw.gameEnd !== undefined) {
		const gameEnd = readGameEnd(raw.gameEnd, `${path}.gameEnd`, issues, reminders);
		if (gameEnd) rules.gameEnd = gameEnd;
	}
	if (raw.deathCheck !== undefined) {
		const at = `${path}.deathCheck`;
		if (!isObject(raw.deathCheck)) {
			issues.add(at, `expected object, got ${describe(raw.deathCheck)}`);
		} else {
			checkKeys(raw.deathCheck, ['kind', 'token'], at, issues);
			const kind = readEnum(raw.deathCheck, 'kind', DEATH_CHECK_KINDS, at, issues, true);
			const token = readToken(raw.deathCheck, 'token', at, issues, reminders);
			if (kind === 'marked-killed-by-demon' && raw.deathCheck.token === undefined) {
				issues.add(`${at}.token`, 'missing');
			} else if (kind) rules.deathCheck = { kind, ...(token ? { token } : {}) };
		}
	}
	if (raw.setupPrep !== undefined) {
		const setupPrep = readSetupPrep(raw.setupPrep, `${path}.setupPrep`, issues, reminders);
		if (setupPrep) rules.setupPrep = setupPrep;
	}
	if (raw.setupModifier !== undefined) {
		const setupModifier = readSetupModifier(raw.setupModifier, `${path}.setupModifier`, issues);
		if (setupModifier) rules.setupModifier = setupModifier;
	}
	if (raw.dayReminders !== undefined) {
		const day = readDayReminders(raw.dayReminders, `${path}.dayReminders`, issues, reminders);
		if (day) rules.dayReminders = day;
	}
	if (raw.deathCause !== undefined) {
		const deathCause = readDeathCause(raw.deathCause, `${path}.deathCause`, issues);
		if (deathCause) rules.deathCause = deathCause;
	}
	if (raw.reminderMovement !== undefined) {
		const at = `${path}.reminderMovement`;
		const movement = readReminderMovement(raw.reminderMovement, at, issues, reminders);
		if (movement) rules.reminderMovement = movement;
	}
	if (raw.reminderPlaceholders !== undefined) {
		const at = `${path}.reminderPlaceholders`;
		const placeholders = readReminderPlaceholders(raw.reminderPlaceholders, at, issues, reminders);
		if (placeholders) rules.reminderPlaceholders = placeholders;
	}
	if (raw.nightText !== undefined) {
		const nightText = readNightText(raw.nightText, `${path}.nightText`, issues);
		if (nightText) rules.nightText = nightText;
	}
	if (raw.dayMark !== undefined) {
		const dayMark = readDayMark(raw.dayMark, `${path}.dayMark`, issues, reminders);
		if (dayMark) rules.dayMark = dayMark;
	}
	if (raw.wakesWhen !== undefined) {
		const wakes = readWakesWhen(raw.wakesWhen, `${path}.wakesWhen`, issues, reminders);
		if (wakes) rules.wakesWhen = wakes;
	}
	if (raw.stopsWaking !== undefined) {
		const at = `${path}.stopsWaking`;
		const stops = readStopsWaking(raw.stopsWaking, at, issues, reminders);
		if (stops) rules.stopsWaking = stops;
	}
	if (raw.stopsKilling !== undefined) {
		const stops = readStopsWaking(raw.stopsKilling, `${path}.stopsKilling`, issues, reminders);
		if (stops) rules.stopsKilling = stops;
	}
	if (raw.keepsAbility !== undefined) {
		const at = `${path}.keepsAbility`;
		const keeps = readKeepsAbility(raw.keepsAbility, at, issues, reminders);
		if (keeps) rules.keepsAbility = keeps;
	}
	if (raw.becomes !== undefined) {
		const becomes = readBecomes(raw.becomes, `${path}.becomes`, issues, reminders);
		if (becomes) rules.becomes = becomes;
	}
	if (raw.makesDemon !== undefined) {
		const makes = readMakesDemon(raw.makesDemon, `${path}.makesDemon`, issues, reminders);
		if (makes) rules.makesDemon = makes;
	}
	if (raw.infoTokenCharacters !== undefined) {
		const at = `${path}.infoTokenCharacters`;
		const filled = readInfoTokenCharacters(raw.infoTokenCharacters, at, issues);
		if (filled) rules.infoTokenCharacters = filled;
	}
	const extraEvil = readBoolean(raw, 'makesExtraEvil', path, issues);
	if (extraEvil !== undefined) rules.makesExtraEvil = extraEvil;
	const jinxesOnly = readBoolean(raw, 'jinxesOnly', path, issues);
	if (jinxesOnly !== undefined) rules.jinxesOnly = jinxesOnly;
	const hiddenAs = readString(raw, 'orHiddenAs', path, issues, false);
	if (hiddenAs !== undefined) rules.orHiddenAs = hiddenAs;
	const gains = readEnum(raw, 'gainsAbilityOf', SEATED_TYPES, path, issues, false);
	if (gains !== undefined) rules.gainsAbilityOf = gains;
	const turns = readTurnsPlayersInto(raw.turnsPlayersInto, path, issues);
	if (turns) rules.turnsPlayersInto = turns;
	Object.assign(rules, readChoiceRules(raw, path, issues, reminders));
	return issues.list.length > before ? undefined : rules;
}

function readPrompts(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Record<ReminderLabel, ReminderPrompt> | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const own = reminders && new Set(reminders.map((r) => r.toLowerCase()));
	const out: Record<ReminderLabel, ReminderPrompt> = {};
	for (const [label, prompt] of Object.entries(raw)) {
		if (own && !own.has(label.toLowerCase())) {
			issues.add(`${path}.${label}`, 'not one of this character’s reminders');
		} else if (!(REMINDER_PROMPTS as readonly unknown[]).includes(prompt)) {
			issues.add(`${path}.${label}`, `unknown prompt ${JSON.stringify(prompt)}`);
		} else out[label] = prompt as ReminderPrompt;
	}
	return out;
}

function readProtects(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Protects | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(
		raw,
		['who', 'token', 'from', 'night', 'storytellerDecides', 'whileNeighboursGood'],
		path,
		issues
	);
	const who = readEnum(raw, 'who', PROTECTS_WHO, path, issues, true);
	const from = readEnum(raw, 'from', PROTECTS_FROM, path, issues, true);
	const flags = {
		...(readBoolean(raw, 'night', path, issues) ? { night: true as const } : {}),
		...(readBoolean(raw, 'storytellerDecides', path, issues)
			? { storytellerDecides: true as const }
			: {}),
		...(readBoolean(raw, 'whileNeighboursGood', path, issues)
			? { whileNeighboursGood: true as const }
			: {})
	};
	if (!who || !from) return undefined;
	if (who !== 'marked') {
		if (raw.token !== undefined) issues.add(`${path}.token`, 'only a marked player has a token');
		return { who, from, ...flags };
	}
	const token = readString(raw, 'token', path, issues, true);
	if (token === undefined) return undefined;
	if (!ownReminder(token, reminders)) {
		issues.add(`${path}.token`, 'not one of this character’s reminders');
		return undefined;
	}
	return { who, token, from, ...flags };
}

function readLearns(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Learns | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(
		raw,
		[
			'measure',
			'type',
			'token',
			'noneWhenAbsent',
			'self',
			'alive',
			'types',
			'alignment',
			'reminders'
		],
		path,
		issues
	);
	const measure = readEnum(raw, 'measure', LEARNS_MEASURES, path, issues, true);
	const type = readEnum(raw, 'type', CHARACTER_TYPES, path, issues, false);
	const token = readToken(raw, 'token', path, issues, reminders);
	const noneWhenAbsent = readBoolean(raw, 'noneWhenAbsent', path, issues);
	const types = readTypes(raw, 'types', path, issues);
	const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, false);
	const self = readBoolean(raw, 'self', path, issues);
	const alive = readBoolean(raw, 'alive', path, issues);
	if (!measure) return undefined;
	if (measure === 'pair-of-type' && !type) issues.add(`${path}.type`, 'missing');
	if (measure === 'demon-or-token' && !token) issues.add(`${path}.token`, 'missing');
	const out: Learns = { measure };
	if (type) out.type = type;
	if (token) out.token = token;
	if (noneWhenAbsent !== undefined) out.noneWhenAbsent = noneWhenAbsent;
	if (types || alignment || self || alive) {
		if (measure !== 'character-of') issues.add(path, 'only `character-of` takes who it is about');
		if (self) out.self = true;
		if (alive) out.alive = true;
		if (types) out.types = types;
		if (alignment) out.alignment = alignment;
	}
	if (raw.reminders !== undefined) {
		const at = `${path}.reminders`;
		if (!isObject(raw.reminders)) {
			issues.add(at, `expected object, got ${describe(raw.reminders)}`);
		} else {
			checkKeys(raw.reminders, ['target', 'other', 'each'], at, issues);
			const placed: NonNullable<Learns['reminders']> = {};
			for (const key of ['target', 'other', 'each'] as const) {
				const label = readToken(raw.reminders, key, at, issues, reminders);
				if (label) placed[key] = label;
			}
			out.reminders = placed;
		}
	}
	return out;
}
