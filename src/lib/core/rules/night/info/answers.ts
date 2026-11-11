/**
 * Night information: answers worked out from the day log and the grimoire, one per
 * `answers` question in a character's rules block. Part of `night-info.ts`.
 */
import type { AnswerGroup, Answers } from '#lib/core/data/character-rules.ts';
import type { DayMark } from '#lib/core/data/parts/day-mark.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import { type CharacterLookup, scriptCharacterIds } from '#lib/core/model/characters.ts';
import {
	alignmentOf,
	getSeat,
	registersAsDead,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type {
	AbnormalCause,
	CharacterGuess,
	DayEntry,
	Game,
	SeatId
} from '#lib/core/model/types.ts';
import type { RegistrationWorld } from '#lib/core/rules/abilities/ability.ts';
import type { Night } from '#lib/core/model/overrides.ts';
import { causesOf } from '#lib/core/rules/night/night-deaths.ts';
import type { ValidReason } from './valid-info.ts';
import { abnormalSinceDawn, demonChoiceUses } from './abnormal-uses.ts';
import {
	mayBeFalseCause,
	type AnswerValue,
	type NightAnswer,
	type Reliability,
	answer,
	anyInfo,
	byWorld,
	fact
} from './reliability.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

function entriesOf<K extends DayEntry['kind']>(game: Game, kind: K) {
	return game.today.entries.filter((e): e is Extract<DayEntry, { kind: K }> => e.kind === kind);
}

/**
 * What happened today that the game alone does not hold, from the log (`diedToday` in the
 * engine): who died since the most recent New day.
 */
export interface NightToday {
	died: readonly SeatId[];
	/** Revived since the New day: a first-night-only character wakes again (the Professor's). */
	revived?: readonly SeatId[];
}

/** Why a building block has nothing to answer, by the group it looks at. */
const EMPTY: Readonly<Record<AnswerGroup['among'], string>> = {
	dead: 'Nobody is dead',
	marked: 'Nobody carries its reminders',
	abnormal: 'No abnormal abilities recorded',
	guessed: 'No guesses logged today',
	nominators: 'No nominations recorded today',
	voters: 'Votes are not recorded',
	executed: 'Nobody died by execution today',
	died: 'Nobody died today',
	everyone: 'No players'
};

/** What the Storyteller marks for a day mark nobody has set yet. */
const UNMARKED: Readonly<Record<DayMark, string>> = {
	'demon-voted': 'Mark whether the Demon voted today',
	'minion-nominated': 'Mark whether a Minion nominated today'
};

type BlockRule = Answers & AnswerGroup;

/**
 * The players a building block looks at (`AnswerGroup.among`), or undefined for a group the app
 * does not record (`voters`). Not for `abnormal`, which `abnormalAbilities` counts.
 */
function groupOf(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: BlockRule,
	today?: NightToday
): SeatId[] | undefined {
	const carrying = (s: SeatId) =>
		rule.token !== undefined &&
		game.seats[s].reminders.some((r) => r.characterId === characterId && r.label === rule.token);
	switch (rule.among) {
		case 'dead':
			return game.seating.filter((s) => registersAsDead(game, s, characters));
		case 'marked':
			return markedSeats(game, characterId);
		case 'nominators':
			return entriesOf(game, 'nomination')
				.map((e) => e.nominator)
				.filter((s, i, all) => all.indexOf(s) === i);
		case 'voters':
		case 'abnormal':
		case 'guessed':
			return undefined;
		case 'executed': {
			// Today's executions from the day log; when the log has none (the Storyteller ran the
			// day without the day screen), the dead player carrying `token`, which is how the
			// Storyteller marks it on the board (it comes off at dawn, `reminderEnds`).
			const logged = entriesOf(game, 'execution')
				.filter((e) => e.died && getSeat(game, e.seatId)?.dead)
				.map((e) => e.seatId);
			const token =
				logged.length === 0 && rule.token ? marked(game, characterId, rule.token) : undefined;
			return [...new Set(token ? [token.seatId] : logged)];
		}
		case 'died': {
			const died = new Set([
				...(today?.died ?? []),
				...[...entriesOf(game, 'execution'), ...entriesOf(game, 'exile')]
					.filter((e) => e.died)
					.map((e) => e.seatId),
				...game.seating.filter(carrying)
			]);
			return game.seating.filter((s) => died.has(s) && getSeat(game, s)?.dead);
		}
		case 'everyone':
			return [...game.seating];
	}
}

/** Whether a player truly is what the block looks for: their true character type and alignment. */
function trulyMatches(game: Game, s: SeatId, rule: BlockRule, characters: CharacterLookup) {
	const type = typeOf(game, s, characters);
	return (
		(!rule.types || (type !== undefined && rule.types.includes(type))) &&
		(!rule.alignment || alignmentOf(game, s) === rule.alignment)
	);
}

/** Whether a player registers as what the block looks for, when players register as `world` says. */
function registersAs(world: RegistrationWorld, s: SeatId, rule: BlockRule) {
	const type = world.type(s);
	return (
		(!rule.types || (type !== undefined && rule.types.includes(type))) &&
		(!rule.alignment || world.alignment(s) === rule.alignment)
	);
}

/**
 * `any`: whether any player of the group matches. The Town Crier learns whether a Minion
 * nominated today (https://wiki.bloodontheclocktower.com/Town_Crier), the Flowergirl whether
 * the Demon voted today (https://wiki.bloodontheclocktower.com/Flowergirl). Who matches goes by
 * how players register: a Recluse who nominated might register as a Minion and a Spy might not
 * (`possible`).
 *
 * The Storyteller's day mark (`mark`), when set and not the same as the group recorded, is the
 * answer; for a group the app does not record (votes), it is the only answer. With nobody
 * recorded in the group the app can't tell a day without nominations from one nobody
 * recorded, so it gives no answer rather than "no" (Trevor, 2026-10-23).
 */
function anyAnswer(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers,
	today?: NightToday
): NightAnswer {
	const block = rule as BlockRule;
	const group = groupOf(game, characterId, characters, block, today);
	const truly = (s: SeatId) => trulyMatches(game, s, block, characters);
	const marked = block.mark ? game.today.marks?.[block.mark] : undefined;
	// A mark that agrees with the group recorded keeps the answer from that group, with who
	// might register otherwise.
	const recorded = group?.some(truly) ?? false;
	if (marked !== undefined && (!group || group.length === 0 || marked !== recorded)) {
		const matching = game.seating.filter(truly);
		return answer(
			game,
			seatId,
			characterId,
			characters,
			{ kind: 'yes-no', value: marked },
			marked ? (group ? matching.filter((s) => group.includes(s)) : matching) : [],
			{ facts: matching.map((s) => fact(game, s, characters)) }
		);
	}
	if (!group) {
		// Votes are not recorded, so anyone who may register as wanted stays relevant.
		const matching = game.seating.filter(truly);
		return answer(
			game,
			seatId,
			characterId,
			characters,
			{ kind: 'none', reason: block.mark ? UNMARKED[block.mark] : EMPTY[block.among] },
			[],
			{ facts: matching.map((s) => fact(game, s, characters)) }
		);
	}
	if (group.length === 0) {
		return answer(
			game,
			seatId,
			characterId,
			characters,
			{ kind: 'none', reason: EMPTY[block.among] },
			[],
			{ relevant: [] }
		);
	}
	if (block.onlyYes) return onlyYesAnswer(game, seatId, characterId, characters, block, group);
	const w = byWorld(game, seatId, characters, (world) => ({
		kind: 'yes-no',
		value: group.some((s) => registersAs(world, s, block))
	}));
	const [base] = w.worlds;
	const matching = group.filter((s) => registersAs(base, s, block));
	return answer(
		game,
		seatId,
		characterId,
		characters,
		{ kind: 'yes-no', value: matching.length > 0 },
		matching,
		{
			possible: w.possible,
			relevant: w.relevant,
			facts: group.map((s) => fact(game, s, characters, base)),
			alternatives: w.alternatives
		}
	);
}

/** What the group did, for saying none of them matched (`onlyYes`). */
const DID: Readonly<Record<AnswerGroup['among'], string>> = {
	dead: 'is dead',
	marked: 'carries its reminders',
	abnormal: 'worked abnormally',
	guessed: 'was guessed',
	nominators: 'nominated today',
	voters: 'voted today',
	executed: 'died by execution today',
	died: 'died today',
	everyone: 'is in play'
};

/**
 * `any` with `onlyYes`: yes when a player of the group truly matches, else nothing to learn.
 * The answer decides whether the character wakes (the Godfather kills tonight when an Outsider
 * died today, https://wiki.bloodontheclocktower.com/Godfather), so it goes by true characters,
 * as the Storyteller's grimoire shows them: a Drunk counts as an Outsider, as does a Recluse.
 */
function onlyYesAnswer(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	block: BlockRule,
	group: SeatId[]
): NightAnswer {
	const matching = group.filter((s) => trulyMatches(game, s, block, characters));
	const who = [
		block.alignment,
		block.types?.map((t) => t[0].toUpperCase() + t.slice(1)).join(' or ') ?? 'player'
	]
		.filter(Boolean)
		.join(' ');
	return answer(
		game,
		seatId,
		characterId,
		characters,
		matching.length === 0
			? { kind: 'none', reason: `No ${who} ${DID[block.among]}` }
			: { kind: 'yes-no', value: true },
		matching,
		{ relevant: matching, facts: matching.map((s) => fact(game, s, characters)) }
	);
}

/**
 * `character`: the character of the latest player in the group who matches. The Undertaker
 * learns the character of the player who died by execution today
 * (https://wiki.bloodontheclocktower.com/Undertaker). The grimoire's true character: the Drunk
 * shows as the Drunk. Nobody in the group: nothing is learnt. With two in it (two executions
 * outside Trouble Brewing), the Storyteller picks which to show: the answer names the latest,
 * both are its reasons, and each is a `possible` answer.
 */
function characterAnswer(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers,
	today?: NightToday
): NightAnswer {
	const block = rule as BlockRule;
	const group = (groupOf(game, characterId, characters, block, today) ?? []).filter((s) =>
		trulyMatches(game, s, block, characters)
	);
	const latest = group.at(-1);
	const id = latest === undefined ? undefined : trueCharacter(game, latest, characters);
	return answer(
		game,
		seatId,
		characterId,
		characters,
		id === undefined
			? { kind: 'none', reason: EMPTY[block.among] }
			: { kind: 'character', value: id },
		group,
		{
			relevant: group,
			facts: group.map((s) => fact(game, s, characters)),
			possible: [
				...new Set([...group].reverse().flatMap((s) => trueCharacter(game, s, characters) ?? []))
			].map((value): AnswerValue => ({ kind: 'character', value }))
		}
	);
}

/**
 * `characters`: the characters of the one type in `types` among the group. The Godfather starts
 * knowing which Outsiders are in play (https://wiki.bloodontheclocktower.com/Godfather): the
 * Storyteller shows the character tokens of every Outsider in play. Worked out from each
 * player's true character:
 * - a Drunk is an Outsider though their token is a Townsfolk, so the Drunk is shown
 *   (https://wiki.bloodontheclocktower.com/Drunk), and an Outsider whose player is drunk or
 *   poisoned is still in play;
 * - dead players' characters are still in play
 *   (https://wiki.bloodontheclocktower.com/Glossary, "In play");
 * - with none in play the answer is no characters: knowing which are in play includes
 *   knowing there are none (our reading of the ability; the wiki page doesn't say);
 * - registration changes what detecting abilities learn (Glossary, "Register"): a Recluse
 *   registering as a Minion or Demon may be left out
 *   (https://wiki.bloodontheclocktower.com/Recluse), and a Spy registering as an Outsider
 *   adds one Outsider of the Storyteller's choice (`more`,
 *   https://wiki.bloodontheclocktower.com/Spy). Each is an allowed answer, the true one first.
 * A drunk or poisoned Godfather may be shown anything (`unreliable`, Glossary, "Drunk").
 */
function charactersAnswer(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers,
	today?: NightToday
): NightAnswer {
	const block = rule as BlockRule;
	const type = block.types![0];
	const group = groupOf(game, characterId, characters, block, today) ?? [];
	const valueIn = (world: RegistrationWorld): AnswerValue => {
		const ids: CharacterId[] = [];
		let more = 0;
		for (const s of group) {
			if (!registersAs(world, s, block)) continue;
			const id = trueCharacter(game, s, characters);
			if (typeOf(game, s, characters) !== type || !id) more++;
			else if (!ids.includes(id)) ids.push(id);
		}
		return {
			kind: 'characters',
			type,
			value: ids,
			...(more > 0 ? { more: { count: more, type } } : {})
		};
	};
	const w = byWorld(game, seatId, characters, valueIn);
	const holders = group.filter((s) => trulyMatches(game, s, block, characters));
	return answer(game, seatId, characterId, characters, valueIn(w.worlds[0]), holders, {
		possible: w.possible,
		relevant: w.relevant,
		facts: holders.map((s) => fact(game, s, characters)),
		alternatives: w.alternatives
	});
}

/** The dead player carrying a character's reminder, as `{ seatId }`. */
function marked(
	game: Game,
	characterId: CharacterId,
	label: string
): { seatId: SeatId } | undefined {
	const seatId = game.seating.find(
		(s) =>
			getSeat(game, s)?.dead &&
			game.seats[s].reminders.some((r) => r.characterId === characterId && r.label === label)
	);
	return seatId ? { seatId } : undefined;
}

/**
 * A `count` among `guessed`: how many of today's guesses are correct, the Juggler's
 * (https://wiki.bloodontheclocktower.com/Juggler). Guesses come from the Juggler's day notes
 * and are checked against each player's true character. Each guess is one player and one
 * character, so a player guessed as two characters is two guesses, and the same player and
 * character guessed twice is two guesses too (Trevor, 2026-11-02).
 *
 * The wiki's How to Run marks each correct guess with a Correct reminder and has the Juggler
 * learn how many there are. Once the Storyteller has placed any (rules `answers.token`), the
 * answer is how many tokens are on the board, their call: each token counts, wherever it
 * sits, so one player may carry several and the Juggler may carry their own (Trevor,
 * 2026-11-02). Until then it is counted from the logged guesses.
 */
function correctGuesses(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers,
	_today?: NightToday,
	basis: SeatId = seatId
): NightAnswer {
	const guesses = entriesOf(game, 'note')
		.filter((n) => n.characterId === characterId && (n.seatId === undefined || n.seatId === basis))
		.flatMap((n) => n.guesses ?? []);
	const right = (g: CharacterGuess) => trueCharacter(game, g.seatId, characters) === g.characterId;
	const correct = guesses.filter(right);
	const once = (seats: SeatId[]) => seats.filter((s, i) => seats.indexOf(s) === i);
	// Each token counts: one seat may carry several, and the Juggler may carry their own.
	const tokens = rule.token
		? game.seating.flatMap((s) =>
				game.seats[s].reminders
					.filter((r) => r.characterId === characterId && r.label === rule.token)
					.map(() => s)
			)
		: [];
	const value: AnswerValue | undefined =
		tokens.length > 0
			? { kind: 'number', value: tokens.length }
			: guesses.length > 0
				? { kind: 'number', value: correct.length }
				: undefined;
	return answer(
		game,
		seatId,
		characterId,
		characters,
		value ?? { kind: 'none', reason: 'No guesses logged today' },
		once(tokens.length > 0 ? tokens : correct.map((g) => g.seatId)),
		{
			relevant: once(guesses.map((g) => g.seatId)),
			facts:
				guesses.length > 0
					? guesses.map((g) => ({
							...fact(game, g.seatId, characters),
							guess: { characterId: g.characterId, correct: right(g) }
						}))
					: once(tokens).map((s) => fact(game, s, characters))
		}
	);
}

/**
 * `statement`: whether today's public statement was true, the Gossip's, so a player dies
 * tonight (https://wiki.bloodontheclocktower.com/Gossip). The truth is the Storyteller's call, marked
 * on the statement in the day log (L58); the latest statement today counts.
 */
function statementTrue(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): NightAnswer {
	const statement = entriesOf(game, 'note').findLast(
		(n) =>
			n.characterId === characterId &&
			(n.seatId === undefined || n.seatId === seatId) &&
			n.text.trim() !== ''
	);
	const out = answer(
		game,
		seatId,
		characterId,
		characters,
		statement === undefined
			? { kind: 'none', reason: 'No statement logged today' }
			: statement.holds === undefined
				? { kind: 'none', reason: 'Mark whether the statement was true' }
				: { kind: 'yes-no', value: statement.holds },
		[],
		{ relevant: [] }
	);
	// The statement is not information, so the Vortox does not make it false.
	delete out.mustBeFalse;
	delete out.falseSeat;
	return out;
}

/** The players carrying one of `characterId`'s reminders, in seating order. */
export function markedSeats(game: Game, characterId: CharacterId): SeatId[] {
	return game.seating.filter((s) =>
		game.seats[s].reminders.some((r) => r.characterId === characterId)
	);
}

/**
 * A `count` (M77): how many players of the group `rule.among` register as `rule.alignment`
 * (every one of them when left out). The Oracle counts the evil dead
 * (https://wiki.bloodontheclocktower.com/Oracle), the Duchess the evil among her visitors, the
 * waking player included (https://wiki.bloodontheclocktower.com/Duchess), and the Mathematician
 * the abilities that worked abnormally (`abnormalAbilities`). Dead as abilities see it, and the
 * alignment the rules use (overrides win): a dead Recluse might register as evil and a dead Spy
 * as good, as both work even if dead (`possible`). With `falseToken` on the waking
 * player, the answer must be false (the Duchess's "False Info").
 */
function countAnswer(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers,
	today?: NightToday,
	basis?: SeatId
): NightAnswer {
	if (rule.question !== 'count') throw new Error('not a count');
	if (rule.among === 'abnormal')
		return abnormalAbilities(game, seatId, characterId, characters, rule, today);
	if (rule.among === 'guessed')
		return correctGuesses(game, seatId, characterId, characters, rule, today, basis);
	const group = groupOf(game, characterId, characters, rule, today) ?? [];
	const matchIn = (w: RegistrationWorld) => group.filter((s) => registersAs(w, s, rule));
	const w = byWorld(game, seatId, characters, (world) => ({
		kind: 'number',
		value: matchIn(world).length
	}));
	const [base] = w.worlds;
	const matching = matchIn(base);
	const out = answer(
		game,
		seatId,
		characterId,
		characters,
		{ kind: 'number', value: matching.length },
		matching,
		{
			possible: w.possible,
			relevant: w.relevant,
			facts: group.map((s) => fact(game, s, characters, base)),
			alternatives: w.alternatives
		}
	);
	const falseInfo =
		rule.falseToken !== undefined &&
		game.seats[seatId]?.reminders.some(
			(r) => r.characterId === characterId && r.label === rule.falseToken
		);
	if (!falseInfo) return out;
	return { ...out, mustBeFalse: true, falseBy: characterId };
}

/**
 * Mathematician: how many players' abilities worked abnormally since dawn because of
 * another character (https://wiki.bloodontheclocktower.com/Mathematician). Once the
 * Storyteller has put the Mathematician's "Abnormal" reminders on players, the answer is
 * how many players carry one (their call); until then it is counted from the info they
 * recorded as abnormal. `abnormal` lists the recorded uses either way, so they can check.
 * Its jinxes count some abilities its own rule leaves out (`abnormalCounts`: the Drunk's and
 * the Marionette's false info, the Lunatic attacking another player than the Demon did).
 */
function abnormalAbilities(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers,
	today?: NightToday
): NightAnswer {
	const abnormal = [
		...abnormalSinceDawn(game, characters, characterId),
		...demonChoiceUses(game, characterId, characters, today?.died ?? [])
	];
	const marked = game.seating.filter((s) =>
		game.seats[s].reminders.some((r) => r.characterId === characterId && r.label === rule.token)
	);
	const recorded = abnormal.map((u) => u.seatId).filter((s, i, all) => all.indexOf(s) === i);
	const because = marked.length > 0 ? marked : recorded;
	return answer(
		game,
		seatId,
		characterId,
		characters,
		{ kind: 'number', value: marked.length > 0 ? marked.length : abnormal.length },
		because,
		// Registration only matters to the abilities it recorded as abnormal.
		{ abnormal, relevant: [], facts: because.map((s) => fact(game, s, characters)) }
	);
}

/**
 * `storyteller`: the Storyteller's own judgement, so there is no answer to work out and each
 * of `choices` is offered. The General learns which team the Storyteller believes is winning,
 * good, evil or neither (https://wiki.bloodontheclocktower.com/General).
 */
function storytellerAnswer(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers
): NightAnswer {
	if (rule.question !== 'storyteller') throw new Error('not a storyteller choice');
	return answer(
		game,
		seatId,
		characterId,
		characters,
		{ kind: 'none', reason: 'Your call: which team is winning' },
		[],
		{
			relevant: [],
			choices: rule.choices.map((value) => ({ kind: 'alignment', value }))
		}
	);
}

type AnswerFn = (
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers,
	today?: NightToday,
	/** Whose own day the answer reads, when not the waking player's (`nightAnswer`). */
	basis?: SeatId
) => NightAnswer;

/** How each `answers` question is worked out. */
const QUESTIONS: Readonly<Record<Answers['question'], AnswerFn>> = {
	count: countAnswer,
	any: anyAnswer,
	character: characterAnswer,
	characters: charactersAnswer,
	statement: statementTrue,
	storyteller: storytellerAnswer
};

/**
 * The night answer for a waking player whose character `answers` a question (its rules
 * block: our `data/rules/<id>.json`, or a custom character's `rules`), or undefined. On the
 * first night, the rule's `firstNight` question when it has one. `basis` is the player whose
 * own day the answer reads when it isn't the waking player's: the executed Juggler's guesses,
 * learned by the Cannibal who gained the ability (`learnsGained` `answer`,
 * https://wiki.bloodontheclocktower.com/Cannibal#Related_Jinxes).
 */
export function nightAnswer(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	today?: NightToday,
	night?: Night,
	basis?: SeatId
): NightAnswer | undefined {
	const rule = rulesFor(game, characterId, characters)?.answers;
	if (!rule) return undefined;
	const asked: Answers =
		night === 'first' && rule.firstNight ? { ...rule, ...rule.firstNight } : rule;
	return QUESTIONS[asked.question](game, seatId, characterId, characters, asked, today, basis);
}

/**
 * Why a recorded answer that is not the true one worked abnormally: the waking player's
 * impairments, else the Vortox, else the players who might register as something else.
 * For answers recorded as free text, where the app cannot compare the choice.
 */
export function answerCauses(a: Reliability & { because?: SeatId[] }): AbnormalCause[] {
	if (a.impairments.length > 0) return causesOf(a.impairments);
	if (a.mayBeFalse) return [mayBeFalseCause(a.mayBeFalse)];
	if (a.mustBeFalse && a.falseBy) {
		return [
			{
				reason: 'false-info',
				characterId: a.falseBy,
				...(a.falseSeat ? { seatId: a.falseSeat } : {})
			}
		];
	}
	return a.registrations.map((r) => ({
		reason: 'registration',
		characterId: r.source.characterId,
		seatId: r.seatId
	}));
}

/** One answer the Storyteller may give, for listing every valid one. */
export interface AnswerOption {
	/**
	 * `invalid`: the true answer under the Vortox, which must not be given. `judgement`: one of
	 * the answers the Storyteller judges between (the General's).
	 */
	reason: ValidReason | 'invalid' | 'judgement';
	value: AnswerValue;
	/** Any other character (`value` is the true one): the script's, to pick from. */
	otherCharacters?: CharacterId[];
	/** Any other set of characters (`value` is the true one): the Storyteller picks them. */
	anyOther?: true;
}

/**
 * Every answer the Storyteller may give while the waking player's ability doesn't work
 * (drunk, poisoned, no ability: any information,
 * https://wiki.bloodontheclocktower.com/Poisoner) or must be false (the Vortox,
 * https://wiki.bloodontheclocktower.com/Vortox): the true answers first, then each false
 * one. Empty when only the truth may be given, or there is nothing to give. An answer that is
 * the Storyteller's judgement (`choices`, the General's) lists each choice.
 */
export function answerOptions(
	game: Game,
	a: NightAnswer,
	characters: CharacterLookup
): AnswerOption[] {
	if (a.choices) return a.choices.map((value) => ({ reason: 'judgement', value }));
	if (a.kind === 'none') return [];
	const loose: ValidReason | undefined = anyInfo(a)
		? 'unreliable'
		: a.anyBy
			? 'any'
			: a.mustBeFalse
				? 'false-info'
				: undefined;
	if (!loose) return [];
	const truthful: AnswerValue[] = a.possible ?? [answerValue(a)];
	const key = (v: AnswerValue) => JSON.stringify(v);
	const taken = new Set(truthful.map(key));
	const out: AnswerOption[] = truthful.map((value, i) => ({
		reason: loose === 'false-info' ? 'invalid' : i === 0 ? 'true' : 'registers',
		value
	}));
	const add = (value: AnswerValue) => {
		if (!taken.has(key(value))) out.push({ reason: loose, value });
	};
	switch (a.kind) {
		case 'yes-no':
			add({ kind: 'yes-no', value: !a.value });
			break;
		case 'alignment':
			for (const value of ['good', 'evil', 'neither'] as const) add({ kind: 'alignment', value });
			break;
		case 'number':
			for (let n = 0; n <= highestAnswer(game, a.characterId, characters); n++) {
				add({ kind: 'number', value: n });
			}
			break;
		case 'character': {
			const shown = new Set(truthful.flatMap((v) => (v.kind === 'character' ? [v.value] : [])));
			const others = scriptCharacterIds(game.script).filter((id) => {
				const type = characters.get(id)?.type;
				return !shown.has(id) && type !== 'fabled' && type !== 'loric';
			});
			if (others.length > 0) {
				out.push({ reason: loose, value: answerValue(a), otherCharacters: others });
			}
			break;
		}
		case 'characters':
			out.push({ reason: loose, value: answerValue(a), anyOther: true });
			break;
	}
	return out;
}

function answerValue(a: NightAnswer): AnswerValue {
	switch (a.kind) {
		case 'yes-no':
			return { kind: 'yes-no', value: a.value };
		case 'alignment':
			return { kind: 'alignment', value: a.value };
		case 'character':
			return { kind: 'character', value: a.value };
		case 'number':
			return { kind: 'number', value: a.value };
		case 'characters':
			return {
				kind: 'characters',
				type: a.type,
				value: a.value,
				...(a.more ? { more: a.more } : {})
			};
		case 'none':
			return { kind: 'none', reason: a.reason };
	}
}

/**
 * The highest number a number answer could be, for listing the false ones: the whole group for
 * a `count` of the dead or the marked, the guesses a day claim may hold for `guessed` (the
 * Juggler's five, https://wiki.bloodontheclocktower.com/Juggler), else every player.
 */
function highestAnswer(game: Game, characterId: CharacterId, characters: CharacterLookup) {
	const rule = rulesFor(game, characterId, characters)?.answers;
	if (rule?.question !== 'count' || rule.among === 'abnormal') return game.seating.length;
	if (rule.among === 'guessed')
		return rulesFor(game, characterId, characters)?.guessLimit ?? game.seating.length;
	return (groupOf(game, characterId, characters, rule) ?? game.seating).length;
}
