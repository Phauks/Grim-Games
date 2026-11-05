/** Search, Library, Prepare, Friends, Profile, History and the app as a whole. Part of the roadmap (roadmap.ts). */
import type { RoadmapItem } from './roadmap.ts';

export const PAGES_AND_APP: readonly RoadmapItem[] = [
	{
		title:
			'Finding scripts: search, the Library, adding JSON, reading a photo of a printed script, editing custom scripts, Almanac links',
		area: 'search',
		parts: ['L23', 'L25', 'P1', 'L51', 'L52', 'L53', 'L55', 'M54']
	},
	{
		title: 'After the game: ratings, Storyteller accolades, sharing the grim',
		area: 'history',
		parts: ['R4', 'R5']
	},
	{
		title: 'Report an issue from inside the app, with diagnostics',
		area: 'app',
		parts: ['S2', 'S7', 'S10', 'S16', 'S28']
	},
	{
		title:
			'Characters page: the Character Lab for everyone, the selected characters on the left and their game on the right',
		area: 'app',
		parts: ['M37', 'M45', 'M47']
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
	{ title: 'Search Settings for any setting by name', area: 'app', parts: ['S24'] },
	{
		title:
			"Print your own script sheet: Letter or A4, your margins, what goes on the front and back (the script's QR code too), or download it as a PDF",
		area: 'prepare',
		// M56 (Trevor, 2026-11-05): a QR code of the script on either side, which opens it.
		parts: ['T1', 'T3', 'M56']
	},
	{ title: 'A background image on the printed sheet', area: 'prepare', parts: ['T2'], later: true },
	{
		title:
			"Rules as data: every character's rules in its own file, none in code, and each character's data on view",
		area: 'prepare',
		parts: ['K1', 'K2']
	},
	{ title: 'Buttons that stand out, with End game in red', area: 'app', parts: ['S11'] },
	{
		title: 'Accounts and sync: saved games and scripts on every device',
		area: 'library',
		parts: ['Y1'],
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
		// Trevor, 2026-11-01: hide empty rows, add the tag-line, and let people add their own
		// details ("Favorite Script") without requiring them.
		title: 'Your tag-line and your own details on your player profile',
		area: 'profile',
		parts: ['R15']
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
	{ title: 'Alternate art packs', area: 'app', parts: ['P2'], later: true },
	{ title: 'A new app logo', area: 'app', parts: ['O1'], later: true }
];
