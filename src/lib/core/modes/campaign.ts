/**
 * Campaigns (pool kind `campaign`, part 14 `betweenGames`; Flesh and Bone): one game after
 * another, each on a script made from the last. Characters that died by execution are
 * eliminated for the rest of the campaign and replaced by a character of the same type that
 * is still available; Demons are added one per game up to the target; the campaign ends when
 * no Demon is left (https://fleshandbone.app/rules.php). The rules' replacement picks come
 * from their own survey data, which we don't have, so replacements are random and the
 * Storyteller can roll any of them again. Per-character exceptions are left to the
 * Storyteller, who decides which executed characters are eliminated.
 */
import type { Alignment, Character, CharacterId } from '#lib/core/data/types.ts';
import { SEATED_TYPES, type SeatedType } from '#lib/core/rules/distribution.ts';
import type { GameRecord } from '#lib/core/stats/record.ts';
import { bannedIn, type StorytellerRestrictions } from './pool.ts';
import type { BetweenGamesRule, GameMode } from './types.ts';

/** The mode's between-games rule, when it runs a campaign. */
export function campaignRule(mode: GameMode): BetweenGamesRule | undefined {
	return mode.parts.betweenGames?.kind === 'campaign' ? mode.parts.betweenGames : undefined;
}

/**
 * The characters that died by execution in a finished game, in the order they were
 * executed, each once. Exile is not an execution (https://wiki.bloodontheclocktower.com/Exile).
 */
export function executedCharacters(record: GameRecord): CharacterId[] {
	const bySeat = new Map(record.seats.map((s) => [s.seatId, s]));
	const out: CharacterId[] = [];
	for (const day of record.dayLog) {
		for (const seatId of day.executed) {
			const seat = bySeat.get(seatId);
			const id = seat?.end?.characterId ?? seat?.start?.characterId;
			if (!seat?.dead || seat.deathCause !== 'execution' || !id) continue;
			// Executed again later (back from the dead): the later execution is the one that counts.
			const at = out.indexOf(id);
			if (at >= 0) out.splice(at, 1);
			out.push(id);
		}
	}
	return out;
}

/** Which executed characters the rule eliminates by default: all of them, or the last. */
export function defaultEliminated(
	rule: BetweenGamesRule,
	executed: readonly CharacterId[]
): CharacterId[] {
	if (rule.eliminate === 'last-executed') return executed.slice(-1);
	return [...executed];
}

const GOOD_TYPES: readonly string[] = ['townsfolk', 'outsider'];
const EVIL_TYPES: readonly string[] = ['minion', 'demon'];

/**
 * "The scripts must flow": when nothing would change, the winning team's first character on
 * the script is eliminated (https://fleshandbone.app/rules.php). Undefined when the winner
 * wasn't recorded, which leaves the choice to the Storyteller.
 */
export function flowCharacter(
	script: readonly Character[],
	winner: Alignment | undefined
): Character | undefined {
	if (!winner) return undefined;
	const types = winner === 'good' ? GOOD_TYPES : EVIL_TYPES;
	return script.find((c) => types.includes(c.type));
}

/**
 * Official characters that can join the campaign's script as a `type`: not on it, never
 * eliminated, not restricted.
 */
export function campaignCandidates(
	mode: GameMode,
	type: SeatedType,
	script: readonly Character[],
	eliminated: Iterable<CharacterId>,
	official: readonly Character[],
	restrictions: StorytellerRestrictions,
	exclude: readonly Character[] = []
): Character[] {
	const banned = bannedIn(mode, restrictions);
	const gone = new Set<CharacterId>(eliminated);
	const taken = new Set([...script, ...exclude].map((c) => c.id));
	return official.filter(
		(c) => c.type === type && !taken.has(c.id) && !gone.has(c.id) && !banned.has(c.id)
	);
}

const isSeated = (type: string): type is SeatedType =>
	(SEATED_TYPES as readonly string[]).includes(type);

export interface NextScriptInput {
	mode: GameMode;
	/** The last game's characters, in script order. */
	script: readonly Character[];
	/** Eliminated after the last game. */
	eliminate: readonly CharacterId[];
	/** Eliminated in earlier games. */
	eliminatedBefore: readonly CharacterId[];
	official: readonly Character[];
	restrictions: StorytellerRestrictions;
	random: () => number;
}

/** One eliminated character and who takes its place (none when no character is left). */
export interface Replacement {
	out: Character;
	in?: Character;
}

export interface NextScript {
	/** In script order: each replacement where its character was, a new Demon after the Demons. */
	characters: Character[];
	replacements: Replacement[];
	/** The Demon added this game (`growDemons`), if one was. */
	added?: Character;
}

function pick<T>(pool: readonly T[], random: () => number): T | undefined {
	return pool.length > 0 ? pool[Math.floor(random() * pool.length)] : undefined;
}

/** Builds the next script from `replacements` and `added` (also used after a roll again). */
export function assembleScript(
	script: readonly Character[],
	replacements: readonly Replacement[],
	added: Character | undefined
): Character[] {
	const swap = new Map(replacements.map((r) => [r.out.id, r.in]));
	const out = script.flatMap((c) => {
		if (!swap.has(c.id)) return [c];
		const next = swap.get(c.id);
		return next ? [next] : [];
	});
	if (added) {
		const lastDemon = out.findLastIndex((c) => c.type === 'demon');
		out.splice(lastDemon >= 0 ? lastDemon + 1 : out.length, 0, added);
	}
	return out;
}

/**
 * The next game's script: each eliminated character replaced by a random available one of
 * the same type (when the rule replaces), then one more Demon while there are fewer than
 * the target (when the rule grows Demons).
 */
export function nextCampaignScript(input: NextScriptInput): NextScript {
	const rule = campaignRule(input.mode);
	const eliminated = [...input.eliminatedBefore, ...input.eliminate];
	const leaving = new Set(input.eliminate);
	const remaining = input.script.filter((c) => !leaving.has(c.id));
	const chosen: Character[] = [];
	const replacements: Replacement[] = [];
	for (const out of input.script.filter((c) => leaving.has(c.id))) {
		let next: Character | undefined;
		if (rule?.replaceSameType && isSeated(out.type)) {
			next = pick(
				campaignCandidates(
					input.mode,
					out.type,
					remaining,
					eliminated,
					input.official,
					input.restrictions,
					chosen
				),
				input.random
			);
		}
		if (next) chosen.push(next);
		replacements.push(next ? { out, in: next } : { out });
	}
	let added: Character | undefined;
	const demons = [...remaining, ...chosen].filter((c) => c.type === 'demon').length;
	if (rule?.growDemons && demons < rule.target.demon) {
		added = pick(
			campaignCandidates(
				input.mode,
				'demon',
				remaining,
				eliminated,
				input.official,
				input.restrictions,
				chosen
			),
			input.random
		);
	}
	return { characters: assembleScript(input.script, replacements, added), replacements, added };
}

/** The campaign is over when its script has no Demon left (`no-demons`). */
export function campaignOver(mode: GameMode, script: readonly Character[]): boolean {
	const rule = campaignRule(mode);
	if (!rule?.endConditions.includes('no-demons')) return false;
	return !script.some((c) => c.type === 'demon');
}
