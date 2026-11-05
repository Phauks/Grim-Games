/** The Storyteller's and the players' features. Part of the roadmap (roadmap.ts). */
import type { RoadmapItem } from './roadmap.ts';
import { range } from './roadmap-parts.ts';

export const STORYTELLER_AND_PLAYER: readonly RoadmapItem[] = [
	{
		title:
			'Grimoire board with a guided night: night steps, reminders, frames, the character sheet',
		area: 'storyteller',
		// M51 (Trevor, 2026-11-04): the night walk-through counts its steps as the tokens' leaves
		// number them, so Dusk, Dawn, Minion info and Demon info get no number.
		parts: ['L8', 'L18a', 'L4', 'L26', 'L59', 'L60', 'L63', 'L66', 'L67', 'L82', 'L94', 'M51']
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
			'L98',
			'M49'
		]
	},
	{
		title:
			'Live rooms: one join code, a vote mixing scripts, modes and special rules, the next game in the same room',
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
			'J42',
			'J43',
			'M33'
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
			'R16',
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
			...range('W', 1, 17),
			...range('E', 1, 4)
		]
	},
	{
		// M55 (Trevor, 2026-11-05): players use the app when it isn't running the game, so with
		// no Storyteller each phone keeps its own town (option A, local only).
		title: 'Players-only game: your own town with no Storyteller',
		area: 'player',
		parts: ['M55']
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
			"Special rules and game modes: +1, Binary Supernovae, Trained Killer, Phantom Detectives, Council of the Dead, The Warrens, The Djinn's Bargain, sharing your own mode files, the Mode builder, requesting missing mode features, one format for modes and rules, mode files in the Library",
		area: 'storyteller',
		parts: ['L1', 'L35', 'L36', 'L103', 'L104', 'L105', 'L106', 'L110', 'L111'],
		prs: [322, 328]
	},
	{
		// M43 (Trevor, 2026-11-03): tried in the background playground first; the Storyteller's
		// is shared with every phone, which can hold it still (2026-11-05).
		title: 'Moving board backgrounds: Vortex, Fire, Rain, Stars and Yin-yang',
		area: 'storyteller',
		parts: ['M43']
	},
	{
		title: 'Savant information: generated, typed or shown to the player',
		area: 'storyteller',
		parts: ['L2', 'L5', 'L41', ...range('L', 46, 50), 'L62']
	},
	{ title: 'QR codes with your own picture and shapes', area: 'player', parts: ['Q1', 'Q2'] },
	{
		title:
			'Game settings: nomination tracking, the day timer on phones and the bag draw chosen for each game',
		area: 'storyteller',
		parts: ['S26']
	},
	{
		title:
			'Sound: every sound in one place, Back to town (also on locked phones), day and night ambience, a soundboard with a mixer and hot spots, sounds for your actions, playing on Town Square or another speaker, your own sounds',
		area: 'storyteller',
		parts: ['U1', 'U2', 'U3', 'U4', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12']
	},
	{
		title:
			"Character selection and bag draw: slot-machine draw, bluff warnings, the Lunatic's bluffs beside the Demon's, lock and hover, dealing to phones",
		area: 'storyteller',
		// M38 (Trevor, 2026-11-03): the Lunatic's bluffs on Character selection.
		parts: ['B6', 'L38', 'L39', 'L40', 'L15', 'L24', 'H1', 'H2', 'M38']
	},
	{
		title:
			'Add late players to the bag draw as more players, not Travellers: placed on the grimoire or seated from a phone, several at once, with Character selection’s list',
		area: 'storyteller',
		parts: ['L96', 'L96a', 'L96b']
	},
	{
		title:
			'Travellers choose their own Traveller on their phones: the Storyteller sends the ones allowed, a tap holds one so no one else can take it, Confirm sends it; a Traveller who arrives mid-game sits at the table not in play until the night offers to bring them in',
		area: 'storyteller',
		parts: ['L102', 'L102a', 'L102b']
	},
	{
		title:
			'Crowded boards: reminders on spokes with a tether, duplicate from the bank, mark where a reminder came from, reminders that stay put marked by a filled word band',
		area: 'storyteller',
		parts: ['D2', 'B2', 'B3', 'B5', 'B1', 'B11', 'B12', 'B13', 'B14']
	},
	{
		title: 'A number token in the reminder bank, for counts and numbers on the board',
		area: 'storyteller',
		parts: ['M35', 'M48']
	},
	{
		title:
			'Day and night counters that move on their own at each dawn or dusk, and number tokens that count up',
		area: 'storyteller',
		parts: ['M53']
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
		title: 'Offline games: share the script with no internet, by QR code or animated QR code',
		area: 'player',
		parts: ['N1', 'N2', 'N3', 'N4']
	},
	{
		// Trevor, 2026-11-03: the board shows what a player is mad as beside their seat, marked !,
		// as it shows what they believe (?). M36: the Cerenovus's night step records the chosen
		// character on its Mad token, and the Pixie is mad as the Townsfolk marked Mad.
		title: '"Mad as" on the board',
		area: 'storyteller',
		parts: ['M36']
	},
	{
		// Trevor, 2026-11-04: "if a character also has the ability of a character, we need to make
		// sure we have the reminder tokens to facilitate that ability". M50: every borrowed ability
		// (gained, held, given by hand, the Storyteller's) brings its character's reminders.
		title: 'Borrowed abilities bring their reminder tokens',
		area: 'storyteller',
		parts: ['M50']
	},
	{
		title: 'Co-Storytelling: two Storytellers on one game',
		area: 'storyteller',
		parts: ['Y2'],
		later: true
	},
	{
		title: 'Vote tracking: who voted on each nomination, and what depends on it',
		area: 'storyteller',
		parts: ['V1'],
		later: true
	}
];
