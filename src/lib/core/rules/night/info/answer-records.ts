/**
 * Night answers read from the day's records and the grimoire: players carrying a character's
 * marks, correct guesses, statements, counts, abnormal abilities and the Storyteller's own call.
 * Read through `nightAnswer` (`answers.ts`).
 */
import type { Answers } from '#lib/core/data/character-rules.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import { type CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { CharacterGuess, Game, SeatId } from '#lib/core/model/types.ts';
import type { RegistrationWorld } from '#lib/core/rules/abilities/registration.ts';
import { abnormalSinceDawn, demonChoiceUses } from './abnormal-uses.ts';
import { type AnswerValue, type NightAnswer, answer, byWorld, fact } from './reliability.ts';

import { entriesOf, type NightToday, groupOf, registersAs } from './answer-groups.ts';

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
export function statementTrue(
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
export function countAnswer(
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
export function storytellerAnswer(
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
