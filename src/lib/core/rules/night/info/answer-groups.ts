/**
 * Night answers about a group of players (`answers` with `among`): whether any of them is of a
 * kind, whether only one answer is yes, and which character or characters they are. Read
 * through `nightAnswer` (`answers.ts`).
 */
import type { AnswerGroup, Answers } from '#lib/core/data/character-rules.ts';
import type { DayMark } from '#lib/core/data/parts/day-mark.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import { type CharacterLookup } from '#lib/core/model/characters.ts';
import {
	alignmentOf,
	getSeat,
	registersAsDead,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type { DayEntry, Game, SeatId } from '#lib/core/model/types.ts';
import type { RegistrationWorld } from '#lib/core/rules/abilities/registration.ts';
import { type AnswerValue, type NightAnswer, answer, byWorld, fact } from './reliability.ts';

export function entriesOf<K extends DayEntry['kind']>(game: Game, kind: K) {
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
export function groupOf(
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
export function registersAs(world: RegistrationWorld, s: SeatId, rule: BlockRule) {
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
export function anyAnswer(
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
export function characterAnswer(
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
export function charactersAnswer(
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

/** The players carrying one of `characterId`'s reminders, in seating order. */
export function markedSeats(game: Game, characterId: CharacterId): SeatId[] {
	return game.seating.filter((s) =>
		game.seats[s].reminders.some((r) => r.characterId === characterId)
	);
}
