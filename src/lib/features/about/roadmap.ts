/**
 * The roadmap, kept in the repository so it ticks itself off: an item is done once a merged
 * change names its ID in brackets in its title, such as "Savant info generator (L2)", or is
 * one of the PRs listed with it. The IDs are the backlog plan's (D1, R1-R7, B1-B6, S1-S6,
 * P1-P2, L1-L28, G1-G13, A1, O1). Add new items here with their ID; never tick them by hand.
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
			{
				id: 'Q1',
				title: "Shape your picture in the QR code's middle: whole or filled, zoom, corners"
			},
			{ id: 'Q2', title: "QR codes' squares and corner markers in other shapes, such as dots" },
			{ id: 'J1', title: "Join game shows nothing from the phone until the room's script arrives" },
			{ id: 'J2', title: 'Scan a code on Join game, with the camera in the app' },
			{ id: 'J3', title: 'Password fields are masked, with an eye button to show them' },
			{
				id: 'J4',
				title: "The script vote shows the room's code and QR, so players can join to vote"
			},
			{ id: 'J5', title: 'The Storyteller can set a time limit on the script vote' },
			{ id: 'J6', title: "The script vote finds scripts with New game's own script controls" },
			{
				id: 'J7',
				title: "The script vote in two columns, with the room's code shown before it opens"
			},
			{ id: 'J8', title: 'Join game has one title and one Share, and a camera icon to scan' },
			{ id: 'J10', title: "The script's logo beside its name on the player's screen" },
			{ id: 'J11', title: 'Joining a game opens the script once you have asked for a seat' },
			{ id: 'J12', title: "The player's Room tab folds into the script view" },
			{ id: 'J13', title: "The player's grim looks exactly like the Storyteller's board" },
			{ id: 'J14', title: "Resume game points players to Join game's list of their games" },
			{ id: 'J15', title: 'Trackpad scrolling over the guess sheet on a laptop' },
			{ id: 'J16', title: 'Join game shows Print and Share only once you have joined' },
			{ id: 'J17', title: 'Open a room and its vote from New game before choosing a script' },
			{ id: 'J18', title: 'The room vote takes any number of scripts' },
			{ id: 'J19', title: 'The room votes on the game mode too' },
			{ id: 'J20', title: 'Every Share opens the same share screen, with the room code in a room' },
			{ id: 'J21', title: "The board's Script has the players' Grim and Notes tabs" },
			{ id: 'J22', title: 'QR settings in a dialog with the QR code on top' },
			{ id: 'R2', title: 'QR codes open the installed app where the platform allows', prs: [320] }
		]
	},
	{
		title: 'New game and Game info',
		items: [
			{ id: 'G1', title: 'New game shows a spinner while a script version loads' },
			{ id: 'G2', title: 'New game previews the script as it will play, beside the settings' },
			{ id: 'G3', title: "Game info downloads the script's file and shares its source" },
			{ id: 'G5', title: 'Game info opens the game mode or a special rule in full when tapped' },
			{ id: 'G6', title: 'A light background switch on every script sheet, also in Settings' },
			{ id: 'G7', title: 'One start flow for every game, with Back on every step' },
			{ id: 'G8', title: 'Change the script from inside a game, keeping its players' },
			{
				id: 'G9',
				title: 'Game info shows everything the board corner can, join code and Game time too'
			},
			{
				id: 'G10',
				title:
					'Sun and moon switch for the script and night order sheets, and a line between character types'
			},
			{ id: 'G11', title: "Game info's Game time shows the day or night in play" },
			{
				id: 'G12',
				title:
					'New game from Game info ends the game and keeps the room and players; no script change mid-game'
			},
			{ id: 'G13', title: "An eye on each Game info line chooses what the board's corner shows" }
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
			{ id: 'L33', title: 'Day ghost votes count: a dark ghost on white', prs: [355] },
			{ id: 'L41', title: 'Savant information: Use these and Cancel always respond' },
			{ id: 'L42', title: 'The Pit-Hag is no longer listed as a day ability' },
			{ id: 'L43', title: 'The Flowergirl’s Demon voted sits in her own row' },
			{ id: 'L44', title: 'Day rows split by dividers, not bordered cards' },
			{ id: 'L45', title: 'Day view in two columns on wide screens' },
			{ id: 'L46', title: 'End of night offers to set Savant information' },
			{ id: 'L47', title: 'Savant information: type your own statements' },
			{ id: 'L48', title: 'Savant information: no lock button' },
			{ id: 'L49', title: 'Savant information: True or False, with the reason' },
			{ id: 'L50', title: 'Savant information: a spoiler-free view to show' },
			{ id: 'L56', title: 'Player claims in town: one way to log them' },
			{ id: 'L57', title: 'Juggler claims: log the guesses' },
			{ id: 'L58', title: 'Gossip claims: log the statement, true or false' },
			{
				id: 'L61',
				title: 'Execution: choose what saved the player, such as the Pacifist or Devil’s Advocate'
			}
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
			{ id: 'L25', title: 'Edit custom scripts in place from the ⋯ menu', prs: [345] },
			{ id: 'P1', title: 'Almanac link in the Glossary', prs: [357] },
			{ id: 'L37', title: "New game opens the chosen script's source page", prs: [368] },
			{ id: 'L51', title: 'Search: the list and the script details as one surface' },
			{ id: 'L52', title: 'Search: open the shown script at its source' },
			{ id: 'L53', title: 'The base three scripts link their wiki pages' },
			{ id: 'L55', title: 'Library: New folder is made at once, named "New folder"' },
			{ id: 'P2', title: 'Alternate art packs in Icons settings' }
		]
	},
	{
		title: 'Character selection and bag',
		items: [
			{ id: 'L15', title: 'Character selection polish: lock, hover areas, no reflow, count popup' },
			{ id: 'L24', title: 'No "held" once a character has been seen' },
			{ id: 'L38', title: 'Character setup keeps the game’s screen, with no sidebar or header' },
			{ id: 'L39', title: 'Show only selected and Random selection take in the Demon bluffs' },
			{ id: 'L40', title: 'A warning when a Demon bluff is also chosen to be in play' },
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
				id: 'S7',
				title: 'Reports: no Admins list or Only mine; admins set in Cloudflare',
				prs: [351]
			},
			{ id: 'S10', title: 'A report sent from a script carries that script' },
			{
				id: 'S11',
				title: 'Buttons stand out from what is behind them; End game is a red button'
			},
			{ id: 'S12', title: 'Lists of information never run together without a line or gap' },
			{ id: 'S17', title: 'Every colour follows the theme: no hard-coded colours' },
			{ id: 'S19', title: 'One icon per meaning: every edit button is the pencil' },
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
