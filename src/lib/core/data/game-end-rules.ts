/**
 * How a character's ability ends the game, keeps it going or changes who wins: the `gameEnd`
 * part of its rules block, read here and worked out in `rules/game-end.ts`. Each entry names
 * a behaviour and its parameters, never a character.
 */
import {
	ALIGNMENTS,
	CHARACTER_TYPES,
	type Alignment,
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
	type Issues
} from './validate.ts';

/**
 * Ways an ability ends the game, each worked out in `rules/game-end.ts`:
 * - `executed-loses`: its player dies by execution, so their team loses (the Saint);
 * - `marked-executed`: while its player lives, the player with its `token` is executed, so
 *   `winner` wins (the Evil Twin's "Twin");
 * - `day-without-execution`: while its player lives, a day ends with no execution, so `winner`
 *   wins (the Vortox);
 * - `alive-at-dusk`: at dusk, with exactly `alive` players alive (Travellers count) and no
 *   execution today, its living player's team wins (the Mayor);
 * - `executions-of-alignment`: while its player lives, `count` players of `alignment` have
 *   been executed, so `winner` wins (the Leviathan's second good execution);
 * - `survives-day`: its player is alive when day `day` ends, so `winner` wins (the Leviathan);
 * - `nominated-marked-executed`: its player nominates the player with its `token` and they are
 *   executed, so that player's team loses (the Fearmonger's "Fear");
 * - `dead-without-demon`: there is no Demon and every player of it is dead, so `winner` wins
 *   (the Summoner, who can no longer summon one);
 * - `extra-day`: the Demon's execution would end the game, so play one more day; then whoever
 *   is executed loses for their team, and nobody executed means good wins (the Mastermind).
 */
const END_KINDS = [
	'executed-loses',
	'marked-executed',
	'day-without-execution',
	'alive-at-dusk',
	'executions-of-alignment',
	'survives-day',
	'nominated-marked-executed',
	'dead-without-demon',
	'extra-day'
] as const;
export type EndKind = (typeof END_KINDS)[number];
export interface EndsGame {
	kind: EndKind;
	token?: ReminderLabel;
	winner?: Alignment;
	alive?: number;
	alignment?: Alignment;
	count?: number;
	day?: number;
}

/**
 * Ways an ability may keep the game going once every Demon is dead:
 * - `marked-alive`: its living player and the player with its `token` are both alive, so good
 *   can't win (the Evil Twin);
 * - `becomes-demon`: its living player may become the Demon while `aliveAtLeast` players
 *   (not Travellers) are still alive (the Scarlet Woman: 5 or more before the Demon died);
 * - `death-passes`: this Demon died by its own kill, so a living `to` player may become it,
 *   until its `spentToken` marks that it happened (the Imp to a Minion; the Fang Gu to an
 *   Outsider, once).
 */
const HOLD_KINDS = ['marked-alive', 'becomes-demon', 'death-passes'] as const;
export type HoldKind = (typeof HOLD_KINDS)[number];
export interface HoldsGame {
	kind: HoldKind;
	token?: ReminderLabel;
	aliveAtLeast?: number;
	to?: CharacterType;
	spentToken?: ReminderLabel;
}

/**
 * - `ends` / `holds`: above;
 * - `aliveWhileDead`: marked dead, its player is still alive for the game's end while sober:
 *   until its `untilToken` marks the real death (the Zombuul's "Dead"), or while the player with
 *   its `whileCarrierAlive` token lives (the Lleech's host, "Poisoned");
 * - `invertWinner`: whoever wins loses, even if its player is dead, unless drunk or poisoned
 *   (the Heretic);
 * - `decidedByStoryteller`: the ability can decide the game through a public claim, guess or
 *   choice only the Storyteller sees, so End game offers it as a reason but nothing checks it
 *   (the Klutz, Damsel, Goblin, Atheist, Cult Leader, Alsaahir, Fiddler).
 */
export interface GameEndRules {
	ends?: readonly EndsGame[];
	holds?: readonly HoldsGame[];
	aliveWhileDead?: { untilToken?: ReminderLabel; whileCarrierAlive?: ReminderLabel };
	invertWinner?: boolean;
	decidedByStoryteller?: boolean;
}

/** The parameters each kind needs. */
const END_NEEDS: Readonly<Record<EndKind, readonly (keyof EndsGame)[]>> = {
	'executed-loses': [],
	'marked-executed': ['token', 'winner'],
	'day-without-execution': ['winner'],
	'alive-at-dusk': ['alive'],
	'executions-of-alignment': ['alignment', 'count', 'winner'],
	'survives-day': ['day', 'winner'],
	'nominated-marked-executed': ['token'],
	'dead-without-demon': ['winner'],
	'extra-day': []
};
const HOLD_NEEDS: Readonly<Record<HoldKind, readonly (keyof HoldsGame)[]>> = {
	'marked-alive': ['token'],
	'becomes-demon': ['aliveAtLeast'],
	'death-passes': ['to']
};

function ownReminder(token: string, reminders: readonly ReminderLabel[] | undefined): boolean {
	return !reminders || reminders.some((r) => r.toLowerCase() === token.toLowerCase());
}

function readToken(
	raw: Record<string, unknown>,
	key: string,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): ReminderLabel | undefined {
	const token = readString(raw, key, path, issues, false);
	if (token === undefined) return undefined;
	if (!ownReminder(token, reminders)) {
		issues.add(`${path}.${key}`, 'not one of this character’s reminders');
		return undefined;
	}
	return token;
}

/** One `ends` or `holds` entry: its kind, then the parameters that kind needs. */
function readKind<K extends string, T extends { kind: K }>(
	raw: unknown,
	path: string,
	issues: Issues,
	kinds: readonly K[],
	needs: Readonly<Record<K, readonly string[]>>,
	reminders: readonly ReminderLabel[] | undefined
): T | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const kind = readEnum(raw, 'kind', kinds, path, issues, true);
	if (!kind) return undefined;
	checkKeys(raw, ['kind', ...needs[kind]], path, issues);
	const out: Record<string, unknown> = { kind };
	for (const key of needs[kind]) {
		let value: unknown;
		if (key === 'token' || key === 'spentToken')
			value = readToken(raw, key, path, issues, reminders);
		else if (key === 'winner' || key === 'alignment')
			value = readEnum(raw, key, ALIGNMENTS, path, issues, false);
		else if (key === 'to') value = readEnum(raw, key, CHARACTER_TYPES, path, issues, false);
		else value = readNumber(raw, key, path, issues);
		if (raw[key] === undefined && key !== 'spentToken') issues.add(`${path}.${key}`, 'missing');
		if (value !== undefined) out[key] = value;
	}
	return out as T;
}

export function readGameEnd(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): GameEndRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(
		raw,
		['ends', 'holds', 'aliveWhileDead', 'invertWinner', 'decidedByStoryteller'],
		path,
		issues
	);
	const out: GameEndRules = {};
	for (const key of ['ends', 'holds'] as const) {
		if (raw[key] === undefined) continue;
		const list = raw[key];
		if (!Array.isArray(list)) {
			issues.add(`${path}.${key}`, `expected array, got ${describe(list)}`);
			continue;
		}
		const read = list.map((entry, i) =>
			key === 'ends'
				? readKind<EndKind, EndsGame>(
						entry,
						`${path}.${key}[${i}]`,
						issues,
						END_KINDS,
						END_NEEDS,
						reminders
					)
				: readKind<HoldKind, HoldsGame>(
						entry,
						`${path}.${key}[${i}]`,
						issues,
						HOLD_KINDS,
						{ ...HOLD_NEEDS, 'death-passes': ['to', 'spentToken'] },
						reminders
					)
		);
		if (key === 'ends') out.ends = read.filter((e): e is EndsGame => e !== undefined);
		else out.holds = read.filter((e): e is HoldsGame => e !== undefined);
	}
	if (raw.aliveWhileDead !== undefined) {
		const at = `${path}.aliveWhileDead`;
		if (!isObject(raw.aliveWhileDead)) {
			issues.add(at, `expected object, got ${describe(raw.aliveWhileDead)}`);
		} else {
			checkKeys(raw.aliveWhileDead, ['untilToken', 'whileCarrierAlive'], at, issues);
			const untilToken = readToken(raw.aliveWhileDead, 'untilToken', at, issues, reminders);
			const whileCarrierAlive = readToken(
				raw.aliveWhileDead,
				'whileCarrierAlive',
				at,
				issues,
				reminders
			);
			out.aliveWhileDead = {
				...(untilToken ? { untilToken } : {}),
				...(whileCarrierAlive ? { whileCarrierAlive } : {})
			};
		}
	}
	for (const key of ['invertWinner', 'decidedByStoryteller'] as const) {
		const value = readBoolean(raw, key, path, issues);
		if (value !== undefined) out[key] = value;
	}
	return out;
}
