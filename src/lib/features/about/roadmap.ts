/**
 * The roadmap, kept in the repository so it ticks itself off: an item is done once a merged
 * change names its ID in brackets in its title, such as "Savant info generator (L2)", or is
 * one of the PRs listed with it. The IDs are the backlog plan's (D1, R1-R7, B1-B6, S1-S6,
 * P1-P2, L1-L28, G1-G5, A1, O1). Add new items here with their ID; never tick them by hand.
 */
import type { BuildCommit } from './update-notes.ts';
import type { Change } from './changelog.ts';

export interface RoadmapItem {
	id: string;
	title: string;
	/** PRs that finish it when merged, for those whose titles don't name the ID. */
	prs?: number[];
}

export interface RoadmapArea {
	title: string;
	items: RoadmapItem[];
}

export const ROADMAP: readonly RoadmapArea[] = [
	{
		title: 'Rooms and sharing',
		items: [
			{
				id: 'D1',
				title: 'One room code: join as a player, or open the grimoire view by password or link'
			},
			{ id: 'L20', title: '"Players\' phones" becomes Share', prs: [323] },
			{
				id: 'L7',
				title: 'Share status: one line per detail; join code and link as headers',
				prs: [323]
			},
			{
				id: 'L19',
				title: 'Setting to hide join details on the grimoire view, for streaming',
				prs: [323]
			},
			{ id: 'L18b', title: 'The view-only grimoire uses the full width on desktop' },
			{
				id: 'G4',
				title: 'Share is one screen: the join code, then the view-only link',
				prs: [365]
			},
			{ id: 'R3', title: 'Watcher count beside the script name on the board' },
			{ id: 'R7', title: "Player view tabs that don't fit move into a ⋯ menu", prs: [318] },
			{
				id: 'R1',
				title: 'Next game in the same room, with a script vote and a custom QR centre logo'
			},
			{ id: 'R6', title: 'Player avatars on seat tokens, from our own set' },
			{ id: 'J1', title: "Join game shows nothing from the phone until the room's script arrives" },
			{ id: 'J2', title: 'Scan a code on Join game, with the camera in the app' },
			{ id: 'J3', title: 'Password fields are masked, with an eye button to show them' },
			{ id: 'R2', title: 'QR codes open the installed app where the platform allows', prs: [320] }
		]
	},
	{
		title: 'New game and Game info',
		items: [
			{ id: 'G1', title: 'New game shows a spinner while a script version loads' },
			{ id: 'G2', title: 'New game previews the script as it will play, beside the settings' },
			{ id: 'G3', title: "Game info downloads the script's file and shares its source" },
			{ id: 'G5', title: 'Game info opens the game mode or a special rule in full when tapped' }
		]
	},
	{
		title: 'Grimoire board',
		items: [
			{
				id: 'L8',
				title: 'Night steps say what to do before the information; nights start on Dusk',
				prs: [321]
			},
			{ id: 'L18a', title: 'Night order position ("1 of 8") as a badge', prs: [321] },
			{ id: 'B2', title: 'Duplicate a reminder from the reminder bank' },
			{ id: 'B3', title: 'Mark the seat a reminder is dragged from' },
			{ id: 'L22', title: 'Rotating players: every name moves with its player' },
			{ id: 'L27', title: 'Random order button for seat name colours' },
			{ id: 'B1', title: 'Generic token icon colour per token' },
			{ id: 'B4', title: 'Fall of Rome reminder counts' },
			{
				id: 'D2',
				title: 'Crowded boards: reminders on spokes with a tether; "+N" stacks as a setting'
			},
			{ id: 'L4', title: 'Token frames to choose from' },
			{ id: 'L26', title: 'Character sheet shows alignment, seat number and character type' }
		]
	},
	{
		title: 'Day',
		items: [
			{ id: 'L12', title: 'Day character rows look like character selection', prs: [337] },
			{ id: 'L21', title: 'Day badges coloured at the top, in ghost colour order', prs: [344] },
			{ id: 'L13', title: 'Execution button; "no execution" is a choice each day', prs: [355] },
			{ id: 'L9', title: 'Announcements include revived players' },
			{ id: 'L28', title: 'Custom characters noted in Announcements' },
			{ id: 'L5', title: 'Savant reminder when no Savant information is set for the next day' },
			{
				id: 'L32',
				title: 'An unnamed seat shows "Seat N" where its name is asked for',
				prs: [364]
			},
			{ id: 'L33', title: 'Day ghost votes count: a dark ghost on white', prs: [355] }
		]
	},
	{
		title: 'Characters and rules',
		items: [
			{ id: 'L1', title: 'The +1 special rule', prs: [314] },
			{ id: 'L35', title: 'The Warrens special rule' },
			{ id: 'L36', title: 'The Djinn’s Bargain special rule' },
			{
				id: 'L11',
				title: 'Godfather: the night step knows whether an Outsider died today',
				prs: [316]
			},
			{
				id: 'L10',
				title: 'Fool: offer to spend the ability when a kill it survives is attempted',
				prs: [325]
			},
			{ id: 'L2', title: 'Savant information generator' }
		]
	},
	{
		title: 'Scripts',
		items: [
			{ id: 'L6', title: 'New game: script search or Library chooses Custom', prs: [312] },
			{ id: 'L14', title: "Game info links the script's source page", prs: [326] },
			{
				id: 'L23',
				title: 'Tell a script from a character or a character collection when adding JSON',
				prs: [329]
			},
			{ id: 'L25', title: 'Edit custom scripts in place from the ⋯ menu' },
			{ id: 'P1', title: 'Almanac link in the Glossary' },
			{ id: 'P2', title: 'Alternate art packs in Icons settings' }
		]
	},
	{
		title: 'Character selection and bag',
		items: [
			{ id: 'L15', title: 'Character selection polish: lock, hover areas, no reflow, count popup' },
			{ id: 'L24', title: 'No "held" once a character has been seen' },
			{ id: 'B6', title: 'Slot-machine character draw, with Sushi Buffet reels' }
		]
	},
	{
		title: 'Settings and app',
		items: [
			{ id: 'S4', title: 'One in-line character badge design everywhere', prs: [311] },
			{ id: 'S2', title: 'Report an issue from the board ⋯ menu', prs: [313] },
			{ id: 'S5', title: 'Bag draw footer clears the bottom bar', prs: [317] },
			{ id: 'S6', title: 'One "not official" notice, linking the official site', prs: [317] },
			{ id: 'S1', title: 'Install app button at the bottom of Settings', prs: [320] },
			{ id: 'S3', title: 'Player name options in Tokens settings', prs: [332] },
			{
				id: 'S11',
				title: 'Buttons stand out from what is behind them; End game is a red button'
			},
			{ id: 'S12', title: 'Lists of information never run together without a line or gap' },
			{ id: 'B5', title: 'Reminder glow and source mark settings' },
			{ id: 'L16', title: 'Glossary: every character of a script and character type', prs: [324] },
			{ id: 'O1', title: 'New app logo' }
		]
	},
	{
		title: 'After the game',
		items: [
			{ id: 'R4', title: 'Ratings, Storyteller accolades and comments', prs: [330] },
			{ id: 'R5', title: 'Share the grimoire with players after the game' },
			{ id: 'A1', title: 'Achievements' }
		]
	}
];

export interface RoadmapEntry extends RoadmapItem {
	/** The change that finished it, once merged. */
	doneBy?: BuildCommit;
}

/** The IDs a change's title names in brackets: "(L8, L18a)", "(L20 + L7)". */
export function idsIn(subject: string): string[] {
	return [...subject.matchAll(/\(([^)]*)\)/g)].flatMap(([, inside]) =>
		inside.split(/[\s,+/&]+/).filter((word) => /^[A-Z]\d+[a-z]?$/.test(word))
	);
}

/** Each area's items, with the change that finished each one. */
export function roadmapStatus(
	areas: readonly RoadmapArea[],
	changes: readonly Change[]
): { title: string; items: RoadmapEntry[] }[] {
	const byId = new Map<string, BuildCommit>();
	const byPr = new Map<number, BuildCommit>();
	// Oldest first, so an item names the change that first finished it.
	for (const change of [...changes].reverse()) {
		const { sha, subject, pr } = change;
		const commit: BuildCommit = pr === undefined ? { sha, subject } : { sha, subject, pr };
		for (const id of idsIn(subject)) if (!byId.has(id)) byId.set(id, commit);
		if (pr !== undefined) byPr.set(pr, commit);
	}
	return areas.map(({ title, items }) => ({
		title,
		items: items.map((item) => {
			const doneBy = byId.get(item.id) ?? item.prs?.map((pr) => byPr.get(pr)).find(Boolean);
			return doneBy ? { ...item, doneBy } : { ...item };
		})
	}));
}
