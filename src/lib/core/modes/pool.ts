/**
 * The characters a mode's game is played with: the mode's pool (part 1), less its banned
 * characters and the Storyteller's own restrictions (part 2), plus characters it always
 * puts on the script (part 7).
 */
import type { Character, CharacterId, Script } from '#lib/core/data/types.ts';
import type { GameMode, ModePart } from './types.ts';
import { isBagDisabled, isNotDealt, isReplacedAfterDraw } from '#lib/core/rules/bag-characters.ts';
import { standInKind } from '#lib/core/rules/bag-plan.ts';

/**
 * The Storyteller's changes to a mode's restrictions for one game (Trevor, 2026-10-17: every
 * mode needs a way to restrict characters). `banned` adds bans; `allowed` lifts the mode's.
 */
export interface StorytellerRestrictions {
	banned: CharacterId[];
	allowed: CharacterId[];
}

export const NO_RESTRICTIONS: StorytellerRestrictions = { banned: [], allowed: [] };

/** Every character banned in this game. */
export function bannedIn(mode: GameMode, own: StorytellerRestrictions): Set<CharacterId> {
	const allowed = new Set(own.allowed);
	const banned = new Set((mode.parts.restricted?.banned ?? []).filter((id) => !allowed.has(id)));
	for (const id of own.banned) banned.add(id);
	return banned;
}

/**
 * The game's characters in order: the script's (or, for an every-character pool, every
 * official character of the listed types in TPI's order), without banned ones, then any the
 * mode always puts on the script.
 */
export function modeCharacters(
	mode: GameMode,
	scriptCharacters: readonly Character[],
	official: readonly Character[],
	own: StorytellerRestrictions = NO_RESTRICTIONS
): Character[] {
	const banned = bannedIn(mode, own);
	const pool = mode.parts.pool;
	const base =
		pool?.kind === 'all-characters'
			? official.filter((c) =>
					(pool.types ?? ['townsfolk', 'outsider', 'minion', 'demon']).includes(c.type)
				)
			: scriptCharacters;
	const out = base.filter((c) => !banned.has(c.id));
	const have = new Set(out.map((c) => c.id));
	// Per-town scripts are the mode's own and already carry what it needs.
	const forced =
		pool?.kind === 'per-town'
			? []
			: [...(mode.parts.forced?.onScript ?? []), ...(mode.parts.forced?.inPlay ?? [])];
	for (const id of forced) {
		const character = official.find((c) => c.id === id);
		if (character && !have.has(id) && !banned.has(id)) {
			out.push(character);
			have.add(id);
		}
	}
	return out;
}

/** The game's script for `modeCharacters`: official ids by id, homebrew with their data. */
export function modeScript(
	mode: GameMode,
	script: Script,
	scriptCharacters: readonly Character[],
	official: readonly Character[],
	own: StorytellerRestrictions = NO_RESTRICTIONS
): Script {
	const custom = new Map(
		script.entries.flatMap((e) => (e.kind === 'custom' ? [[e.character.id, e] as const] : []))
	);
	const characters = modeCharacters(mode, scriptCharacters, official, own);
	const out: Script = {
		...script,
		meta:
			mode.parts.pool?.kind === 'all-characters'
				? { ...script.meta, name: mode.name }
				: script.meta,
		entries: characters.map((c) => custom.get(c.id) ?? { kind: 'official', id: c.id })
	};
	return out;
}

/** Characters players may choose or be offered: the game's, less those that can't be chosen. */
export function choosableCharacters(mode: GameMode, characters: readonly Character[]): Character[] {
	const not = new Set(mode.parts.restricted?.notChoosable ?? []);
	return characters.filter((c) => !not.has(c.id));
}

/**
 * Characters a player can be offered or choose and then simply hold: choosable, dealt as
 * themselves, and not a secret stand-in. The Drunk, Marionette and Lunatic don't know what
 * they are (https://wiki.bloodontheclocktower.com/Drunk,
 * https://wiki.bloodontheclocktower.com/Marionette, https://wiki.bloodontheclocktower.com/Lunatic),
 * so a player can't knowingly pick them; the Storyteller places them on the board instead.
 */
export function pickableCharacters(mode: GameMode, characters: readonly Character[]): Character[] {
	return choosableCharacters(mode, characters).filter(
		(c) =>
			!isBagDisabled(c) &&
			!isNotDealt(c) &&
			!isReplacedAfterDraw(c) &&
			standInKind(c) === undefined &&
			['townsfolk', 'outsider', 'minion', 'demon'].includes(c.type)
	);
}

/**
 * Whether this app runs the part as the mode sets it; any other part is shown in Inspect and
 * run by the Storyteller. Parts a mode leaves out are standard, which the app always runs.
 */
export function runsPart(mode: GameMode, part: ModePart): boolean {
	const p = mode.parts;
	switch (part) {
		case 'pool':
			return (
				!p.pool ||
				p.pool.kind === 'script' ||
				p.pool.kind === 'all-characters' ||
				p.pool.kind === 'per-town' ||
				// Each game's script is made from the last on the campaign page (campaign.ts).
				p.pool.kind === 'campaign' ||
				// Hidden extras are rolled on the Storyteller's device (extras.ts).
				p.pool.kind === 'script-plus-hidden'
			);
		case 'restricted':
			return true;
		case 'forced':
			return (
				!p.forced ||
				(p.forced.inPlay.length === 0 &&
					!p.forced.ruleCharacters?.length &&
					!p.forced.homebrew?.length)
			);
		case 'counts':
			// Separate towns split the players evenly (towns.ts townSizes).
			return !p.counts || p.counts.kind === 'standard' || p.counts.kind === 'per-town';
		case 'setupModifiers':
			return !p.setupModifiers || p.setupModifiers.kind === 'standard';
		case 'assignment':
			return !p.assignment || p.assignment.kind === 'bag';
		case 'duplicates':
			return !p.duplicates || p.duplicates.kind === 'standard';
		case 'towns':
			// One saved game per town, tied together on the towns page.
			return true;
		case 'betweenGames':
			return !p.betweenGames || p.betweenGames.kind === 'campaign';
		case 'winConditions':
			return !p.winConditions || p.winConditions.kind === 'standard';
		default:
			return p[part] === undefined;
	}
}
