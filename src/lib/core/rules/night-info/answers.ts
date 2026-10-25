/**
 * Night information: answers worked out from the day log and the grimoire, one per
 * `answers` question in a character's rules block. Part of `night-info.ts`.
 */
import type { Answers } from '#lib/core/data/character-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { getSeat, registersAsDead, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type {
	AbnormalCause,
	CharacterGuess,
	DayEntry,
	Game,
	SeatId
} from '#lib/core/model/types.ts';
import type { RegistrationWorld } from '../ability.ts';
import { distinctGuesses } from '../day-claims.ts';
import { causesOf } from '../night-deaths.ts';
import {
	type AbnormalUse,
	type NightAnswer,
	type Reliability,
	answer,
	byWorld,
	fact
} from './reliability.ts';

function entriesOf<K extends DayEntry['kind']>(game: Game, kind: K) {
	return game.today.entries.filter((e): e is Extract<DayEntry, { kind: K }> => e.kind === kind);
}

/**
 * Town Crier: whether a Minion nominated today, and who
 * (https://wiki.bloodontheclocktower.com/Town_Crier). Uses each nominator's true character;
 * a Recluse who nominated might register as a Minion and a Spy might not (`possible`).
 *
 * The answer comes from the nominations recorded today (seat sheet or day view). With none
 * recorded the app can't tell a day without nominations from one nobody recorded, so it
 * gives no answer rather than "no" (Trevor, 2026-10-23).
 */
function minionNominated(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): NightAnswer {
	const nominators = entriesOf(game, 'nomination')
		.map((e) => e.nominator)
		.filter((s, i, all) => all.indexOf(s) === i);
	if (nominators.length === 0) {
		return answer(
			game,
			seatId,
			characterId,
			characters,
			{ kind: 'none', reason: 'No nominations recorded today' },
			[],
			{ relevant: [] }
		);
	}
	const w = byWorld(game, seatId, characters, (world) => ({
		kind: 'yes-no',
		value: nominators.some((s) => world.type(s) === 'minion')
	}));
	const [base] = w.worlds;
	const minions = nominators.filter((s) => base.type(s) === 'minion');
	return answer(
		game,
		seatId,
		characterId,
		characters,
		{ kind: 'yes-no', value: minions.length > 0 },
		minions,
		{
			possible: w.possible,
			relevant: w.relevant,
			facts: nominators.map((s) => fact(game, s, characters, base)),
			alternatives: w.alternatives
		}
	);
}

/**
 * Flowergirl: whether the Demon voted today (https://wiki.bloodontheclocktower.com/Flowergirl).
 * Votes are not tracked, so this is the Storyteller's "Demon voted" mark.
 */
function demonVoted(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): NightAnswer {
	const demons = game.seating.filter((s) => typeOf(game, s, characters) === 'demon');
	const voted = game.today.demonVoted;
	return answer(
		game,
		seatId,
		characterId,
		characters,
		voted === undefined
			? { kind: 'none', reason: 'Mark whether the Demon voted today' }
			: { kind: 'yes-no', value: voted },
		voted ? demons : [],
		// Votes are not tracked, so anyone who may register as the Demon stays relevant.
		{ facts: demons.map((s) => fact(game, s, characters)) }
	);
}

/**
 * Undertaker: the character of the player who died by execution today
 * (https://wiki.bloodontheclocktower.com/Undertaker). The grimoire's true character: the
 * Drunk shows as the Drunk. Nobody died by execution: the Undertaker learns nothing.
 *
 * Today's execution comes from the day log; when the log has none (the Storyteller ran the
 * day without the day screen), from the dead player carrying the Undertaker's "Died Today"
 * reminder, which is how the Storyteller marks it on the board.
 */
function executedCharacter(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers
): NightAnswer {
	const executed =
		entriesOf(game, 'execution').findLast((e) => e.died && getSeat(game, e.seatId)?.dead) ??
		(rule.token ? marked(game, characterId, rule.token) : undefined);
	const id = executed && trueCharacter(game, executed.seatId, characters);
	return answer(
		game,
		seatId,
		characterId,
		characters,
		id === undefined
			? { kind: 'none', reason: 'Nobody died by execution today' }
			: { kind: 'character', value: id },
		executed ? [executed.seatId] : [],
		{
			relevant: executed ? [executed.seatId] : [],
			facts: executed ? [fact(game, executed.seatId, characters)] : []
		}
	);
}

/**
 * What happened today that the game alone does not hold, from the log (`diedToday` in the
 * engine): who died since the most recent New day.
 */
export interface NightToday {
	died: readonly SeatId[];
}

/**
 * Godfather: whether an Outsider died today, so the Godfather wakes tonight to kill
 * (https://wiki.bloodontheclocktower.com/Godfather). An Outsider is a player whose true
 * character is an Outsider (a Drunk counts, as does a Recluse). Deaths come from today's
 * deaths in the log (`today`), today's executions and exiles, and the Godfather's "Died
 * Today" reminder on a dead Outsider, which is how the Storyteller marks it on the board.
 */
function outsiderDied(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers,
	today?: NightToday
): NightAnswer {
	const marked = game.seating.filter((s) =>
		game.seats[s].reminders.some((r) => r.characterId === characterId && r.label === rule.token)
	);
	const died = new Set([
		...(today?.died ?? []),
		...[...entriesOf(game, 'execution'), ...entriesOf(game, 'exile')]
			.filter((e) => e.died)
			.map((e) => e.seatId),
		...marked
	]);
	const outsiders = game.seating.filter(
		(s) => died.has(s) && getSeat(game, s)?.dead && typeOf(game, s, characters) === 'outsider'
	);
	return answer(
		game,
		seatId,
		characterId,
		characters,
		outsiders.length === 0
			? { kind: 'none', reason: 'No Outsider died today' }
			: { kind: 'yes-no', value: true },
		outsiders,
		{ relevant: outsiders, facts: outsiders.map((s) => fact(game, s, characters)) }
	);
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
 * Juggler: how many of today's guesses are correct
 * (https://wiki.bloodontheclocktower.com/Juggler). Guesses come from the Juggler's day notes
 * and are checked against each player's true character. Each guess is one player and one
 * character, so a player guessed as two characters is two guesses; the same pair twice
 * counts once.
 */
function correctGuesses(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): NightAnswer {
	const guesses = distinctGuesses(
		entriesOf(game, 'note')
			.filter(
				(n) => n.characterId === characterId && (n.seatId === undefined || n.seatId === seatId)
			)
			.flatMap((n) => n.guesses ?? [])
	);
	const right = (g: CharacterGuess) => trueCharacter(game, g.seatId, characters) === g.characterId;
	const correct = guesses.filter(right);
	const once = (seats: SeatId[]) => seats.filter((s, i) => seats.indexOf(s) === i);
	return answer(
		game,
		seatId,
		characterId,
		characters,
		guesses.length === 0
			? { kind: 'none', reason: 'No guesses logged today' }
			: { kind: 'number', value: correct.length },
		once(correct.map((g) => g.seatId)),
		{
			relevant: once(guesses.map((g) => g.seatId)),
			facts: guesses.map((g) => ({
				...fact(game, g.seatId, characters),
				guess: { characterId: g.characterId, correct: right(g) }
			}))
		}
	);
}

/**
 * Gossip: whether today's public statement was true, so a player dies tonight
 * (https://wiki.bloodontheclocktower.com/Gossip). The truth is the Storyteller's call, marked
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
	delete out.vortox;
	return out;
}

/**
 * Oracle: how many dead players are evil (https://wiki.bloodontheclocktower.com/Oracle).
 * Dead as abilities see it, and the alignment the rules use (overrides win). A dead Recluse
 * might register as evil and a dead Spy as good: both work even if dead (`possible`).
 */
function evilDead(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): NightAnswer {
	const evilIn = (w: RegistrationWorld) =>
		game.seating.filter((s) => registersAsDead(game, s) && w.alignment(s) === 'evil');
	const w = byWorld(game, seatId, characters, (world) => ({
		kind: 'number',
		value: evilIn(world).length
	}));
	const [base] = w.worlds;
	const evilDead = evilIn(base);
	return answer(
		game,
		seatId,
		characterId,
		characters,
		{ kind: 'number', value: evilDead.length },
		evilDead,
		{
			possible: w.possible,
			relevant: w.relevant,
			facts: game.seating
				.filter((s) => registersAsDead(game, s))
				.map((s) => fact(game, s, characters, base)),
			alternatives: w.alternatives
		}
	);
}

/**
 * Every ability that worked abnormally since dawn because of another character, from the
 * night info the Storyteller recorded (its `abnormal` causes), one per player and
 * character. The Mathematician's own ability does not count, nor does a cause that is the
 * ability itself (https://wiki.bloodontheclocktower.com/Mathematician). The day log runs
 * from the last "New day", which the Storyteller presses at dawn.
 */
export function abnormalSinceDawn(game: Game, characters?: CharacterLookup): AbnormalUse[] {
	const out: AbnormalUse[] = [];
	const key = (c: AbnormalCause) => `${c.reason}:${c.characterId ?? ''}:${c.seatId ?? ''}`;
	for (const e of entriesOf(game, 'info')) {
		// The counting ability's own information does not count (the Mathematician's).
		if (rulesOf(e.characterId, characters)?.answers?.question === 'abnormal-abilities') continue;
		const causes = (e.abnormal ?? []).filter(
			(c) => !(c.characterId === e.characterId && c.seatId === e.seatId)
		);
		if (causes.length === 0) continue;
		const use = out.find((u) => u.seatId === e.seatId && u.characterId === e.characterId);
		if (!use) {
			out.push({
				seatId: e.seatId,
				characterId: e.characterId,
				causes: [...causes],
				entryIds: [e.entryId]
			});
			continue;
		}
		use.entryIds.push(e.entryId);
		for (const c of causes) if (!use.causes.some((d) => key(d) === key(c))) use.causes.push(c);
	}
	return out;
}

/**
 * Mathematician: how many players' abilities worked abnormally since dawn because of
 * another character (https://wiki.bloodontheclocktower.com/Mathematician). Once the
 * Storyteller has put the Mathematician's "Abnormal" reminders on players, the answer is
 * how many players carry one (their call); until then it is counted from the info they
 * recorded as abnormal. `abnormal` lists the recorded uses either way, so they can check.
 */
function abnormalAbilities(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers
): NightAnswer {
	const abnormal = abnormalSinceDawn(game, characters);
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

type AnswerFn = (
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	rule: Answers,
	today?: NightToday
) => NightAnswer;

/** How each `answers` question is worked out. */
const QUESTIONS: Readonly<Record<Answers['question'], AnswerFn>> = {
	'minion-nominated': minionNominated,
	'demon-voted': demonVoted,
	'executed-character': executedCharacter,
	'outsider-died': outsiderDied,
	'correct-guesses': correctGuesses,
	'evil-dead': evilDead,
	'abnormal-abilities': abnormalAbilities,
	'statement-true': statementTrue
};

/**
 * The night answer for a waking player whose character `answers` a question (its rules
 * block: our `data/rules/<id>.json`, or a custom character's `rules`), or undefined.
 */
export function nightAnswer(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	today?: NightToday
): NightAnswer | undefined {
	const rule = rulesOf(characterId, characters)?.answers;
	return rule && QUESTIONS[rule.question](game, seatId, characterId, characters, rule, today);
}

/**
 * Why a recorded answer that is not the true one worked abnormally: the waking player's
 * impairments, else the Vortox, else the players who might register as something else.
 * For answers recorded as free text, where the app cannot compare the choice.
 */
export function answerCauses(a: Reliability & { because?: SeatId[] }): AbnormalCause[] {
	if (a.impairments.length > 0) return causesOf(a.impairments);
	if (a.mustBeFalse) {
		return [{ reason: 'vortox', characterId: 'vortox', ...(a.vortox ? { seatId: a.vortox } : {}) }];
	}
	return a.registrations.map((r) => ({
		reason: 'registration',
		characterId: r.source.characterId,
		seatId: r.seatId
	}));
}
