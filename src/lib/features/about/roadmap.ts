/**
 * The roadmap, kept in the repository so it ticks itself off. Each item is a feature, made of
 * the backlog plan's IDs (such as D1, L2 or W10; the plan lists them all):
 * a part is finished once a merged change names its ID in brackets in its title, such as
 * "Savant info generator (L2)", and an item is done once all its parts and listed PRs are.
 * Only the features are shown, grouped by the area of the app they belong to (Trevor,
 * 2026-10-30). Add a new plan ID to the feature it belongs to, or a new feature for it in its
 * area; bug fixes and polish need no item. Never tick anything by hand.
 */
import type { BuildCommit } from './update-notes.ts';
import type { Change } from './changelog.ts';

/**
 * The page's sections, in its order (Trevor, 2026-10-30: "delineate between storyteller,
 * player, search, saved, friends, user profile, etc."; Storyteller and Player come first).
 * Search, Library, Friends and History are the menu's own pages; Prepare is the menu's group
 * for what is made before a game (the builders, Info tokens, the Character reference, the
 * printed sheet); App is everything the whole app shares. Engine (Trevor, 2026-10-31) is the
 * rules the app plays by: every official character's behaviour as data, on the way to full
 * parity with no character written into code.
 */
export const ROADMAP_AREAS = [
	'storyteller',
	'player',
	'engine',
	'search',
	'library',
	'prepare',
	'friends',
	'profile',
	'history',
	'app'
] as const;
export type RoadmapArea = (typeof ROADMAP_AREAS)[number];

export interface RoadmapItem {
	title: string;
	area: RoadmapArea;
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
		area: 'storyteller',
		parts: ['L8', 'L18a', 'L4', 'L26', 'L59', 'L60', 'L63', 'L66', 'L67', 'L82', 'L94']
	},
	{
		title:
			'Day view: executions, announcements, Savant reminders, player claims, who abilities were used on',
		area: 'storyteller',
		parts: [
			'L12',
			'L13',
			'L21',
			'L9',
			'L28',
			'L45',
			'L56',
			'L57',
			'L58',
			'L61',
			'L68',
			'L69',
			'L95',
			'L98'
		]
	},
	{
		title:
			'Live rooms: one join code, a script, mode and special rules vote, the next game in the same room',
		area: 'player',
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
			'J35',
			'J36',
			'J37',
			'J38',
			'J39',
			'J40',
			'J41',
			'J42'
		]
	},
	{
		title: "Player screen: the script, the town's grim, notes, avatars and frames",
		area: 'player',
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
			...range('W', 1, 16),
			...range('E', 1, 4)
		]
	},
	{
		title: 'One start flow: New game, then Game info during the game',
		area: 'storyteller',
		parts: [
			...range('G', 1, 3),
			...range('G', 5, 7),
			'G9',
			'G10',
			'G14',
			'G15',
			'G16',
			...range('G', 17, 20),
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
		area: 'search',
		parts: ['L23', 'L25', 'P1', 'L51', 'L52', 'L53', 'L55']
	},
	{
		title:
			"Special rules and game modes: +1, Binary Supernovae, Trained Killer, Phantom Detectives, Council of the Dead, The Warrens, The Djinn's Bargain, sharing your own mode files, the Mode builder, requesting missing mode features, one format for modes and rules",
		area: 'storyteller',
		parts: ['L1', 'L35', 'L36', 'L103', 'L104', 'L105', 'L110', 'L111'],
		prs: [322, 328]
	},
	{
		title: 'Savant information: generated, typed or shown to the player',
		area: 'storyteller',
		parts: ['L2', 'L5', 'L41', ...range('L', 46, 50), 'L62']
	},
	{
		title:
			'Custom characters that follow their own rules: kill, protect, drunk and poison, win conditions, night information',
		area: 'engine',
		parts: ['L74'],
		prs: [410, 420, 429, 445, 459, 460, 462, 463, 465, 472, 482, 485, 488, 491]
	},
	{
		title: 'After the game: ratings, Storyteller accolades, sharing the grim',
		area: 'history',
		parts: ['R4', 'R5']
	},
	{ title: 'QR codes with your own picture and shapes', area: 'player', parts: ['Q1', 'Q2'] },
	{
		title: 'Report an issue from inside the app, with diagnostics',
		area: 'app',
		parts: ['S2', 'S7', 'S10', 'S16', 'S28']
	},
	{
		title: 'Admins see every account, and sign one out, free its username or delete it',
		area: 'app',
		parts: ['S27']
	},
	{
		title: 'One consistent look: one badge, theme colours only, one icon per meaning',
		area: 'app',
		parts: ['S4', 'S6', 'S12', 'S17', 'S19', 'S20']
	},
	{ title: 'Install as an app', area: 'app', parts: ['S1'] },
	{ title: 'A Support page with a Ko-fi link', area: 'app', parts: ['S23'] },
	{ title: 'A Credits page in the menu', area: 'app', parts: ['S25'] },
	{
		title: 'Settings profiles: save your board and settings, and pick one for each game',
		area: 'app',
		parts: ['S18', 'S21']
	},
	{ title: 'Choose the app language (English for now)', area: 'app', parts: ['S22'] },
	{
		title:
			'Game settings: nomination tracking, the day timer on phones and the bag draw chosen for each game',
		area: 'storyteller',
		parts: ['S26']
	},
	{ title: 'Search Settings for any setting by name', area: 'app', parts: ['S24'] },
	{
		title:
			'Print your own script sheet: Letter or A4, your margins, and what goes on the front and back, or download it as a PDF',
		area: 'prepare',
		parts: ['T1', 'T3']
	},
	{ title: 'A background image on the printed sheet', area: 'prepare', parts: ['T2'], later: true },
	{
		title:
			'Sound: every sound in one place, Back to town (also on locked phones), day and night ambience, a soundboard with a mixer and hot spots, sounds for your actions, playing on Town Square or another speaker, your own sounds',
		area: 'storyteller',
		parts: ['U1', 'U2', 'U3', 'U4', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12']
	},
	{
		title:
			'Character selection and bag draw: slot-machine draw, bluff warnings, lock and hover, dealing to phones',
		area: 'storyteller',
		parts: ['B6', 'L38', 'L39', 'L40', 'L15', 'L24', 'H1', 'H2']
	},
	{
		title:
			'Add late players to the bag draw as more players, not Travellers: placed on the grimoire or seated from a phone, several at once, with Character selection’s list',
		area: 'storyteller',
		parts: ['L96', 'L96a', 'L96b']
	},
	{
		title:
			'Travellers choose their own Traveller on their phones: the Storyteller sends the ones allowed, a tap holds one so no one else can take it, Confirm sends it; a Traveller who arrives mid-game sits at the table not in play until the night',
		area: 'storyteller',
		parts: ['L102', 'L102a']
	},
	{
		title:
			'Crowded boards: reminders on spokes with a tether, duplicate from the bank, mark where a reminder came from',
		area: 'storyteller',
		parts: ['D2', 'B2', 'B3', 'B5', 'B1', 'B11', 'B12', 'B13']
	},
	{
		title: 'Seats that keep their names when players rotate, and random name colours',
		area: 'storyteller',
		parts: ['L22', 'L27']
	},
	{
		title: 'New game from Game info, keeping the room and players, and a board corner you choose',
		area: 'storyteller',
		parts: ['G11', 'G12', 'G13', 'R3']
	},
	{
		title:
			"Rules as data: every character's rules in its own file, none in code, and each character's data on view",
		area: 'prepare',
		parts: ['K1', 'K2']
	},
	{ title: 'Buttons that stand out, with End game in red', area: 'app', parts: ['S11'] },
	{
		title: 'Offline games: share the script with no internet, by QR code or animated QR code',
		area: 'player',
		parts: ['N1', 'N2', 'N3', 'N4']
	},
	{
		title: 'Accounts and sync: saved games and scripts on every device',
		area: 'library',
		parts: ['Y1'],
		later: true
	},
	{
		// Trevor, 2026-10-30/31: chosen at the start, shown on or off with the special rules.
		title: "Characters' optional rules, chosen at the start of the game",
		area: 'engine',
		parts: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M14']
	},
	{
		// The ability parts gap list (/mnt/project-files/ability-parts/gaps.md), gaps 2 to 5.
		title:
			"Every official character's ability as data: night information, character and alignment changes, abilities held without a token",
		area: 'engine',
		parts: [
			'L70',
			'L71',
			'L72',
			'L73',
			'L75',
			'L76',
			'L77',
			'L78',
			'L79',
			'L80',
			'L81',
			'L83',
			'L84',
			'L85',
			'L86',
			'L87',
			'L88',
			'L89',
			'L90',
			'L91',
			'L92',
			'L93',
			// Small token Option A (Trevor, 2026-10-31): who a player really is, marked =.
			'L101'
		],
		prs: [828, 833, 838, 841, 843, 846, 847, 849, 851, 853, 855, 857]
	},
	{
		// Gap 2: characters whose information the Storyteller still works out by hand. M10a
		// Chambermaid, M10b Puzzlemaster, M10c Widow, M10d Damsel, M10e Storm Catcher, M10f Zenomancer, M10g the Storm Catcher's named character saved.
		title:
			'Valid information for the Chambermaid, Puzzlemaster, Widow, Damsel, Storm Catcher and Zenomancer',
		area: 'engine',
		parts: ['M10a', 'M10b', 'M10c', 'M10d', 'M10e', 'M10f', 'M10g']
	},
	{
		// Gap 8: the Bigwig's chosen speaker; gap 12: one-offs with no behaviour yet: M12a the
		// Scapegoat, M12b the Boomdandy, M12c the Courtier's countdown.
		title: "The Bigwig's speaker, the Scapegoat, the Boomdandy and the Courtier's three nights",
		area: 'engine',
		parts: ['M11', 'M12a', 'M12b', 'M12c']
	},
	{
		// Gap 1, last and separate (Trevor, 2026-10-28).
		title:
			'Voting and nominations: vote weight, who may vote or nominate, forced and blocked executions (Butler, Thief, Bureaucrat, Bishop, Legion and 12 more)',
		area: 'engine',
		parts: ['M9']
	},
	{
		// The wiki examples each character's test file lists as still to do, a batch per edition
		// (M13b Trouble Brewing). Examples the engine can't pass yet are written as it.fails.
		title: 'Every wiki example tested, for every character',
		area: 'engine',
		parts: ['M13a', 'M13b', 'M13']
	},
	{
		// Wiki example gaps no other thread owned (Nov 2): M17a Knaves, M17b Wizard, M17c
		// Yaggababble, M17d Ojo, M17e Al-Hadikhia, M17f Angel, M17g Savant.
		title:
			"The Knaves' lying Storyteller, the Wizard's wishes, the Yaggababble's phrase, the Ojo, the Al-Hadikhia, the Angel's punishment and the Savant's statements about people",
		area: 'engine',
		parts: ['M17a', 'M17b', 'M17c', 'M17d', 'M17e', 'M17f', 'M17g']
	},
	{
		// Trevor, 2026-10-30: on the roadmap, after a spike and research.
		title: 'Jinxes the app applies, not only shows',
		area: 'engine',
		parts: ['L99', 'L100']
	},
	{
		title: 'Co-Storytelling: two Storytellers on one game',
		area: 'storyteller',
		parts: ['Y2'],
		later: true
	},
	{
		// Trevor approved the plan 2026-10-29 (https://claude.ai/artifact/8ahBpAozQZ3UUpxVQ5QVoT).
		// F6 is groups since 2026-10-30 (Trevor: groups "should replace f6").
		title: 'Friends: add friends, see who you played with, invite them to games, join groups',
		area: 'friends',
		parts: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8']
	},
	{
		// Trevor, 2026-10-30, from the idea roadmap (https://claude.ai/artifact/EMMicZLmAGjdgFxtN39eow).
		title:
			'Friends: invite people new to the app, suggestions from your games, hand the room to a friend',
		area: 'friends',
		parts: ['F12', 'F13', 'F14']
	},
	{
		// Trevor, 2026-10-30: "number of games should be a statistic on a users page".
		title: 'Games played on your profile, for anyone who taps it',
		area: 'profile',
		parts: ['F11']
	},
	{
		// Trevor, 2026-10-30: "hey, use this script to a friend. Or ... point at their profile".
		title: 'Friends: send a script to a friend, and show scripts on your profile',
		area: 'friends',
		parts: ['F9', 'F10']
	},
	{
		title: 'Achievements and laurels, and History stats',
		area: 'profile',
		parts: ['A1a', 'A1d', 'A1'],
		later: true
	},
	{
		title: 'Game replay: step through a saved game with a filterable history beside the grim',
		area: 'history',
		parts: ['R9'],
		later: true
	},
	{
		title: 'Vote tracking: who voted on each nomination, and what depends on it',
		area: 'storyteller',
		parts: ['V1'],
		later: true
	},
	{ title: 'Alternate art packs', area: 'app', parts: ['P2'], later: true },
	{ title: 'A new app logo', area: 'app', parts: ['O1'], later: true }
];

export interface RoadmapEntry extends RoadmapItem {
	/** How many of its parts and PRs have merged. */
	finished: number;
	total: number;
	/** The change that finished it, once every part has merged. */
	doneBy?: BuildCommit;
}

export interface RoadmapAreaEntries {
	area: RoadmapArea;
	/** Unfinished first, then later, then done. */
	items: RoadmapEntry[];
	done: number;
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

/** Each area that has features, in the page's order, with its unfinished features first. */
export function roadmapByArea(status: RoadmapStatus): RoadmapAreaEntries[] {
	return ROADMAP_AREAS.map((area) => {
		const inArea = (entries: RoadmapEntry[]) => entries.filter((entry) => entry.area === area);
		const done = inArea(status.done);
		return {
			area,
			items: [...inArea(status.next), ...inArea(status.later), ...done],
			done: done.length
		};
	}).filter(({ items }) => items.length > 0);
}
