/**
 * The roadmap, kept in the repository so it ticks itself off. Each item is a feature, made of
 * the backlog plan's IDs (such as D1, L2 or W10; the plan lists them all):
 * a part is finished once a merged change names its ID in brackets in its title, such as
 * "Savant info generator (L2)", and an item is done once all its parts and listed PRs are.
 * Only the features are shown. Add a new plan ID to the feature it belongs to, or a new
 * feature for it; bug fixes and polish need no item. Never tick anything by hand.
 */
import type { BuildCommit } from './update-notes.ts';
import type { Change } from './changelog.ts';

export interface RoadmapItem {
	title: string;
	/** The plan IDs it is made of. */
	parts?: string[];
	/** PRs that are part of it, for work whose titles name no ID. */
	prs?: number[];
	/** Not planned for now. */
	later?: true;
}

/** Parts whose PR titles didn't name them: the PR that finished each. */
export const PART_PRS: Readonly<Record<string, number>> = {
	L7: 323,
	L19: 323,
	L20: 323,
	G4: 365,
	R7: 318,
	R2: 320,
	L8: 321,
	L18a: 321,
	L12: 337,
	L21: 344,
	L13: 355,
	L1: 314,
	L6: 312,
	L14: 326,
	L23: 329,
	L25: 345,
	P1: 357,
	L37: 368,
	S4: 311,
	S2: 313,
	S6: 317,
	S1: 320,
	S7: 351,
	R4: 330
};

const range = (prefix: string, from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

export const ROADMAP: readonly RoadmapItem[] = [
	{
		title:
			'Grimoire board with a guided night: night steps, reminders, frames, the character sheet',
		parts: [
			'L8',
			'L18a',
			'L4',
			'L26',
			'L59',
			'L60',
			'L63',
			'L66',
			'L67',
			'L70',
			'L71',
			'L72',
			'L73',
			'L75',
			'L76',
			'L77',
			'L78'
		]
	},
	{
		title: 'Day view: executions, announcements, Savant reminders, player claims',
		parts: ['L12', 'L13', 'L21', 'L9', 'L28', 'L45', 'L56', 'L57', 'L58', 'L61', 'L68', 'L69']
	},
	{
		title:
			'Live rooms: one join code, a script, mode and special rules vote, the next game in the same room',
		parts: [
			'D1',
			'R1',
			'R2',
			'G4',
			'L7',
			'L19',
			'L20',
			...range('J', 1, 8),
			...range('J', 14, 20),
			'J22',
			'J23',
			'J24',
			'J25',
			'J26',
			'J27',
			'J29',
			'J30',
			'J31',
			'J33',
			'J35'
		]
	},
	{
		title: "Player screen: the script, the town's grim, notes, avatars and frames",
		parts: [
			'R6',
			'R7',
			'R8',
			'R10',
			'R11',
			'J10',
			'J11',
			'J12',
			'J13',
			'J21',
			'J28',
			'J32',
			'J34',
			'R12',
			'R13',
			'R14',
			'L18b',
			...range('W', 1, 12),
			...range('E', 1, 4)
		]
	},
	{
		title: 'One start flow: New game, then Game info during the game',
		parts: [
			...range('G', 1, 3),
			...range('G', 5, 7),
			'G9',
			'G10',
			'G14',
			'G15',
			'G16',
			'L6',
			'L14',
			'L37',
			'L64',
			'L65'
		]
	},
	{
		title:
			'Finding scripts: search, the Library, adding JSON, editing custom scripts, Almanac links',
		parts: ['L23', 'L25', 'P1', 'L51', 'L52', 'L53', 'L55']
	},
	{
		title:
			"Special rules and game modes: +1, Binary Supernovae, Trained Killer, Phantom Detectives, Council of the Dead, The Warrens, The Djinn's Bargain",
		parts: ['L1', 'L35', 'L36'],
		prs: [322, 328]
	},
	{
		title: 'Savant information: generated, typed or shown to the player',
		parts: ['L2', 'L5', 'L41', ...range('L', 46, 50), 'L62']
	},
	{
		title:
			'Custom characters that follow their own rules: kill, protect, drunk and poison, win conditions, night information',
		parts: ['L74'],
		prs: [410, 420, 429, 445, 459, 460, 462, 463, 465, 472, 482, 485, 488, 491]
	},
	{
		title: 'After the game: ratings, Storyteller accolades, sharing the grim',
		parts: ['R4', 'R5']
	},
	{ title: 'QR codes with your own picture and shapes', parts: ['Q1', 'Q2'] },
	{
		title: 'Report an issue from inside the app, with diagnostics',
		parts: ['S2', 'S7', 'S10', 'S16']
	},
	{
		title: 'One consistent look: one badge, theme colours only, one icon per meaning',
		parts: ['S4', 'S6', 'S12', 'S17', 'S19', 'S20']
	},
	{ title: 'Install as an app', parts: ['S1'] },
	{ title: 'A Support page with a Ko-fi link', parts: ['S23'] },
	{ title: 'A Credits page in the menu', parts: ['S25'] },
	{
		title: 'Settings profiles: save your board and settings, and pick one for each game',
		parts: ['S18', 'S21']
	},
	{ title: 'Choose the app language (English for now)', parts: ['S22'] },
	{
		title:
			'Game settings: nomination tracking, the day timer on phones and the bag draw chosen for each game',
		parts: ['S26']
	},
	{ title: 'Search Settings for any setting by name', parts: ['S24'] },
	{
		title:
			'Sound: every sound in one place, Back to town (also on locked phones), day and night ambience, a soundboard with a mixer and hot spots, sounds for your actions, playing on Town Square or another speaker, your own sounds',
		parts: ['U1', 'U2', 'U3', 'U4', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12']
	},
	{
		title:
			'Character selection and bag draw: slot-machine draw, bluff warnings, lock and hover, dealing to phones',
		parts: ['B6', 'L38', 'L39', 'L40', 'L15', 'L24', 'H1', 'H2']
	},
	{
		title:
			'Crowded boards: reminders on spokes with a tether, duplicate from the bank, mark where a reminder came from',
		parts: ['D2', 'B2', 'B3', 'B5', 'B1', 'B11']
	},
	{
		title: 'Seats that keep their names when players rotate, and random name colours',
		parts: ['L22', 'L27']
	},
	{
		title: 'New game from Game info, keeping the room and players, and a board corner you choose',
		parts: ['G11', 'G12', 'G13', 'R3']
	},
	{
		title:
			"Rules as data: every character's rules in its own file, none in code, and each character's data on view",
		parts: ['K1', 'K2']
	},
	{ title: 'Buttons that stand out, with End game in red', parts: ['S11'] },
	{
		title: 'Offline games: share the script with no internet, by QR code or animated QR code',
		parts: ['N1', 'N2', 'N3', 'N4']
	},
	{
		title: 'Accounts and sync: saved games and scripts on every device',
		parts: ['Y1'],
		later: true
	},
	{ title: 'Co-Storytelling: two Storytellers on one game', parts: ['Y2'], later: true },
	{
		// Trevor approved the plan 2026-10-29 (https://claude.ai/artifact/8ahBpAozQZ3UUpxVQ5QVoT).
		title: 'Friends: add friends, see who you played with, invite them to games',
		parts: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8']
	},
	{
		title: 'Achievements and laurels, and History stats',
		parts: ['A1a', 'A1d', 'A1'],
		later: true
	},
	{
		title: 'Game replay: step through a saved game with a filterable history beside the grim',
		parts: ['R9'],
		later: true
	},
	{
		title: 'Vote tracking: who voted on each nomination, and what depends on it',
		parts: ['V1'],
		later: true
	},
	{ title: 'Alternate art packs', parts: ['P2'], later: true },
	{ title: 'A new app logo', parts: ['O1'], later: true }
];

export interface RoadmapEntry extends RoadmapItem {
	/** How many of its parts and PRs have merged. */
	finished: number;
	total: number;
	/** The change that finished it, once every part has merged. */
	doneBy?: BuildCommit;
}

export interface RoadmapStatus {
	done: RoadmapEntry[];
	next: RoadmapEntry[];
	later: RoadmapEntry[];
}

/** The IDs a change's title names in brackets: "(L8, L18a)", "(L20 + L7)". */
export function idsIn(subject: string): string[] {
	return [...subject.matchAll(/\(([^)]*)\)/g)].flatMap(([, inside]) =>
		inside.split(/[\s,+/&]+/).filter((word) => /^[A-Z]\d+[a-z]?$/.test(word))
	);
}

/** Each item with how far along it is, split into done, next and later. */
export function roadmapStatus(
	items: readonly RoadmapItem[],
	changes: readonly Change[],
	partPrs: Readonly<Record<string, number>> = PART_PRS
): RoadmapStatus {
	// Each change's position, oldest first, so a finished item names its last piece.
	const byId = new Map<string, number>();
	const byPr = new Map<number, number>();
	const commits = [...changes].reverse().map(({ sha, subject, pr }, at): BuildCommit => {
		for (const id of idsIn(subject)) if (!byId.has(id)) byId.set(id, at);
		if (pr !== undefined) byPr.set(pr, at);
		return pr === undefined ? { sha, subject } : { sha, subject, pr };
	});
	const status: RoadmapStatus = { done: [], next: [], later: [] };
	for (const item of items) {
		const pieces = [
			...(item.parts ?? []).map((id) => {
				const pr = partPrs[id];
				return byId.get(id) ?? (pr === undefined ? undefined : byPr.get(pr));
			}),
			...(item.prs ?? []).map((pr) => byPr.get(pr))
		];
		const merged = pieces.filter((at) => at !== undefined);
		const entry: RoadmapEntry = { ...item, finished: merged.length, total: pieces.length };
		if (pieces.length > 0 && merged.length === pieces.length) {
			status.done.push({ ...entry, doneBy: commits[Math.max(...merged)] });
		} else (item.later ? status.later : status.next).push(entry);
	}
	return status;
}
