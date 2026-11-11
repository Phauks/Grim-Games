/**
 * Night information: answers worked out from the day log and the grimoire, one per
 * `answers` question in a character's rules block. Each question family has its own file
 * (`answer-groups.ts`, `answer-records.ts`); this one picks the answer and lists its options.
 */
import type { Answers } from '#lib/core/data/character-rules.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import { type CharacterLookup, scriptCharacterIds } from '#lib/core/model/characters.ts';
import type { AbnormalCause, Game, SeatId } from '#lib/core/model/types.ts';
import type { Night } from '#lib/core/model/overrides.ts';
import { causesOf } from '#lib/core/rules/night/night-deaths.ts';
import type { ValidReason } from './valid-info.ts';
import {
	mayBeFalseCause,
	type AnswerValue,
	type NightAnswer,
	type Reliability,
	anyInfo
} from './reliability.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

import {
	type NightToday,
	groupOf,
	anyAnswer,
	characterAnswer,
	charactersAnswer
} from './answer-groups.ts';
import { statementTrue, countAnswer, storytellerAnswer } from './answer-records.ts';

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
