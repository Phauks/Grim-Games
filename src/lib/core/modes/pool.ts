/**
 * The characters a mode's game is played with: the mode's pool (part 1), less its banned
 * characters and the Storyteller's own restrictions (part 2), plus characters it always
 * puts on the script (part 7).
 */
import type { Character, CharacterId, Script } from '#lib/core/data/types.ts';
import type { CombinedParts, GameMode, ModePart, RulePart } from './types.ts';
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

/**
 * The characters a town's game always has in play: the town's own (`towns.inPlay`), or for a
 * single game the mode's `forced.inPlay`.
 */
export function inPlayFor(mode: GameMode, town = 0): CharacterId[] {
	const perTown = mode.parts.towns?.inPlay;
	if (perTown) return perTown[town] ?? [];
	return mode.parts.forced?.inPlay ?? [];
}

/** Whether the Demon learns bluffs in this mode (no: Sushi Buffet, Whale Buffet). */
export function demonBluffs(mode: GameMode): boolean {
	return mode.parts.bluffs?.kind !== 'none';
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
 * Characters a player can secretly be while holding the Townsfolk they kept: an Outsider
 * with an "Is The …" token, the Drunk (https://wiki.bloodontheclocktower.com/Drunk). A draft
 * can't offer it (`pickableCharacters`), so the Storyteller picks which drafted Townsfolk is
 * really it once the draft is done, as Grimbits' draft tool does
 * (https://grimbits.com/draft-buffet/).
 */
export function hiddenAsTownsfolk(characters: readonly Character[]): Character[] {
	return characters.filter((c) => c.type === 'outsider' && isReplacedAfterDraw(c));
}

/**
 * Whether this app runs the part as the mode sets it; any other part is shown in Inspect and
 * run by the Storyteller. Parts a mode leaves out are standard, which the app always runs.
 */
/** Whether the app runs a part of a mode, a combined mode or a special rule. */
export function runsPart(mode: { parts: CombinedParts }, part: ModePart | RulePart): boolean {
	const p: CombinedParts = mode.parts;
	switch (part) {
		case 'text':
			// A rule's lines go on the script's Bootlegger when the game starts (features/modes/start.ts).
			return true;
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
				// Characters always in play are put in setup's selection (features/modes/in-play.ts).
				(!p.forced.ruleCharacters?.length && !p.forced.homebrew?.length)
			);
		case 'counts':
			// Separate towns split the players evenly (towns.ts townSizes).
			return !p.counts || p.counts.kind === 'standard' || p.counts.kind === 'per-town';
		case 'setupModifiers':
			return (
				!p.setupModifiers ||
				p.setupModifiers.kind === 'standard' ||
				// A draft applies each drafted character's change (draft.ts).
				(p.setupModifiers.kind === 'as-chosen' && p.assignment?.kind === 'draft')
			);
		case 'assignment':
			return !p.assignment || p.assignment.kind === 'bag';
		case 'duplicates':
			return !p.duplicates || p.duplicates.kind === 'standard';
		case 'bluffs':
			// No bluffs is the Storyteller's to run until the Demon info step reads `demonBluffs`.
			return !p.bluffs || p.bluffs.kind === 'standard';
		case 'participants':
			// Spectators join on their phones like players and vote there (Specters).
			return !p.participants || p.participants.spectators === 'shared-ability';
		case 'daySteps':
			return (p.daySteps ?? []).every((s) => s.kind === 'spectator-vote');
		case 'towns':
			// One saved game per town, tied together on the towns page.
			return true;
		case 'betweenGames':
			return !p.betweenGames || p.betweenGames.kind === 'campaign';
		case 'abilities':
			// Run Night Order wakes whoever has an ability under the rule (GrimoireBoard `wakes`).
			return !p.abilities || p.abilities.kind === 'dead-keep';
		case 'demonAttacks':
			// The walk-through names the next target on the Demon's step (NightStrip).
			return !p.demonAttacks || p.demonAttacks.kind === 'script-order';
		case 'nominations':
			// The board offers each effect when a nomination is recorded (NominationPrompt).
			return true;
		case 'nightSteps':
			// A one-night step for the dead joins that night's order (night-steps.ts).
			return (p.nightSteps ?? []).every((s) => s.when === 'one-night' && s.dead === true);
		case 'winConditions':
			return (
				!p.winConditions ||
				p.winConditions.kind === 'standard' ||
				// The game end prompt checks for an executed Demon (core/rules/game-end.ts).
				p.winConditions.kind === 'demon-executed'
			);
		default:
			return p[part as keyof CombinedParts] === undefined;
	}
}
