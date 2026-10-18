/**
 * Setup reminders, curated (Trevor reviews and edits this list).
 *
 * Once the characters are in the grimoire, these are the reminder tokens the Storyteller
 * places before the first night (while setting up and preparing the first night's
 * information), plus the few that go down at the start of the first day. Only tokens the
 * Storyteller decides are listed: a token that marks what a player chooses at night (the
 * Sailor's or Poisoner's) is placed when they choose, so it is not here.
 *
 * Each entry lists the tokens one character needs (`label` is TPI's reminder name):
 * - `target: { self: true }`: on this character's own seat (the Drunk's "Is The Drunk");
 * - `target: { choose, choice }`: on a player the Storyteller picks. `choose` filters the
 *   candidates by the true character and the seat's alignment; when exactly one player
 *   fits, the app pre-fills them. `choice` is the short hint shown when it can't.
 *   `notSelf` leaves out this character's own seat. A player already pre-filled for an
 *   earlier token of the same character is left out too (the Washerwoman's WRONG never
 *   lands on her TOWNSFOLK player).
 * - `when`: only when the grimoire matches: at least or exactly so many Outsiders in play
 *   (true characters), or at least so many copies of this character (Village Idiot).
 * - `timing`: 'setup' before the first night, 'first-day' at the start of the first day.
 *
 * Wiki: each `wiki` is the character's page; `reason` is our own summary, never wiki
 * prose. Every official character not listed here is in `NO_SETUP_REMINDERS` with why (a
 * test checks every character is in exactly one of the two lists).
 */
import type { CharacterId } from '#lib/core/data/types.ts';

export type SetupTiming = 'setup' | 'first-day';

/**
 * Who may get the token, read from the grimoire:
 * - `any`: any player;
 * - `good` / `evil`: by the seat's alignment;
 * - `townsfolk` / `outsider` / `minion`: by the true character's type;
 * - `not-demon`: any player whose true character isn't a Demon;
 * - `same-alignment`: a player of this character's alignment;
 * - `copies`: one of the players who have this character (Village Idiots);
 * - `nearest-townsfolk-anticlockwise` / `-clockwise`: the nearest Townsfolk that way round
 *   from this character, alive or dead (No Dashii, `nearestOfType`).
 */
export type SeatFilter =
	| 'any'
	| 'good'
	| 'evil'
	| 'townsfolk'
	| 'outsider'
	| 'minion'
	| 'not-demon'
	| 'same-alignment'
	| 'copies'
	| 'nearest-townsfolk-anticlockwise'
	| 'nearest-townsfolk-clockwise';

export type SetupTarget =
	{ self: true } | { choose: SeatFilter; choice: string; notSelf?: boolean };

export interface SetupCondition {
	minOutsiders?: number;
	exactOutsiders?: number;
	minCopies?: number;
}

export interface SetupReminderSpec {
	label: string;
	/**
	 * What the Storyteller does, as one short line with the token in [brackets]. Tokens of
	 * one character with the same text are one step (the Knight's 2 KNOW tokens).
	 */
	text: string;
	target: SetupTarget;
	reason: string;
	timing?: SetupTiming;
	when?: SetupCondition;
}

export interface SetupReminderEntry {
	id: CharacterId;
	wiki: string;
	reminders: readonly SetupReminderSpec[];
}

const W = 'https://wiki.bloodontheclocktower.com/';
const self = { self: true } as const;

export const SETUP_REMINDER_ENTRIES: readonly SetupReminderEntry[] = [
	// Townsfolk
	{
		id: 'washerwoman',
		wiki: `${W}Washerwoman`,
		reminders: [
			{
				label: 'Townsfolk',
				text: 'Choose a Townsfolk to show the Washerwoman: put [Townsfolk] on them',
				target: { choose: 'townsfolk', choice: 'a Townsfolk player', notSelf: true },
				reason: 'Marks the Townsfolk the Washerwoman learns about'
			},
			{
				label: 'Wrong',
				text: 'Choose a player: put [Wrong] on them',
				target: { choose: 'any', choice: 'any player' },
				reason: 'Marks the second player the Washerwoman is shown'
			}
		]
	},
	{
		id: 'librarian',
		wiki: `${W}Librarian`,
		reminders: [
			{
				label: 'Outsider',
				text: 'Choose an Outsider to show the Librarian: put [Outsider] on them',
				target: { choose: 'outsider', choice: 'an Outsider player', notSelf: true },
				reason: 'Marks the Outsider the Librarian learns about (none in play: they learn 0)',
				when: { minOutsiders: 1 }
			},
			{
				label: 'Wrong',
				text: 'Choose a player: put [Wrong] on them',
				target: { choose: 'any', choice: 'any player' },
				reason: 'Marks the second player the Librarian is shown',
				when: { minOutsiders: 1 }
			}
		]
	},
	{
		id: 'investigator',
		wiki: `${W}Investigator`,
		reminders: [
			{
				label: 'Minion',
				text: 'Choose a Minion to show the Investigator: put [Minion] on them',
				target: { choose: 'minion', choice: 'a Minion player', notSelf: true },
				reason: 'Marks the Minion the Investigator learns about'
			},
			{
				label: 'Wrong',
				text: 'Choose a player: put [Wrong] on them',
				target: { choose: 'any', choice: 'any player' },
				reason: 'Marks the second player the Investigator is shown'
			}
		]
	},
	{
		id: 'fortuneteller',
		wiki: `${W}Fortune_Teller`,
		reminders: [
			{
				label: 'Red Herring',
				text: 'Choose a good player as the [Red Herring]',
				target: { choose: 'good', choice: 'any good player, even the Fortune Teller' },
				reason: 'This good player registers as a Demon to the Fortune Teller'
			}
		]
	},
	{
		id: 'grandmother',
		wiki: `${W}Grandmother`,
		reminders: [
			{
				label: 'Grandchild',
				text: 'Choose a good player: put [Grandchild] on them',
				target: { choose: 'good', choice: 'a good player', notSelf: true },
				reason: 'The Grandmother learns this player and their character'
			}
		]
	},
	{
		id: 'steward',
		wiki: `${W}Steward`,
		reminders: [
			{
				label: 'Know',
				text: 'Choose a good player to show the Steward: put [Know] on them',
				target: { choose: 'good', choice: 'a good player', notSelf: true },
				reason: 'The good player the Steward is shown'
			}
		]
	},
	{
		id: 'knight',
		wiki: `${W}Knight`,
		reminders: [
			{
				label: 'Know',
				text: 'Choose 2 players who aren’t the Demon: put [Know] on each',
				target: { choose: 'not-demon', choice: 'a player who isn’t the Demon', notSelf: true },
				reason: 'First of the 2 players the Knight is shown'
			},
			{
				label: 'Know',
				text: 'Choose 2 players who aren’t the Demon: put [Know] on each',
				target: {
					choose: 'not-demon',
					choice: 'a player who isn’t the Demon',
					notSelf: true
				},
				reason: 'Second of the 2 players the Knight is shown'
			}
		]
	},
	{
		id: 'noble',
		wiki: `${W}Noble`,
		reminders: [
			{
				label: 'Know',
				text: 'Choose 3 players for the Noble, exactly 1 evil: put [Know] on each',
				target: { choose: 'evil', choice: 'an evil player' },
				reason: 'The one evil player among the 3 the Noble is shown'
			},
			{
				label: 'Know',
				text: 'Choose 3 players for the Noble, exactly 1 evil: put [Know] on each',
				target: { choose: 'good', choice: 'a good player', notSelf: true },
				reason: 'A good player among the 3 the Noble is shown'
			},
			{
				label: 'Know',
				text: 'Choose 3 players for the Noble, exactly 1 evil: put [Know] on each',
				target: { choose: 'good', choice: 'another good player', notSelf: true },
				reason: 'A good player among the 3 the Noble is shown'
			}
		]
	},
	{
		id: 'pixie',
		wiki: `${W}Pixie`,
		reminders: [
			{
				label: 'Mad',
				text: 'Choose an in-play Townsfolk to show the Pixie: put [Mad] on them',
				target: { choose: 'townsfolk', choice: 'an in-play Townsfolk', notSelf: true },
				reason: 'The Townsfolk the Pixie is shown and must be mad about'
			}
		]
	},
	{
		id: 'bountyhunter',
		wiki: `${W}Bounty_Hunter`,
		reminders: [
			{
				label: 'Know',
				text: 'Choose an evil player to show the Bounty Hunter: put [Know] on them',
				target: { choose: 'evil', choice: 'an evil player' },
				reason: 'The evil player the Bounty Hunter is shown'
			}
		]
	},
	{
		id: 'balloonist',
		wiki: `${W}Balloonist`,
		reminders: [
			{
				label: 'Know',
				text: 'Choose any player to show the Balloonist: put [Know] on them',
				target: { choose: 'any', choice: 'any player' },
				reason: 'The player the Balloonist is shown on the first night'
			}
		]
	},
	{
		id: 'nodashii',
		wiki: `${W}No_Dashii`,
		reminders: [
			{
				label: 'Poisoned',
				text: 'Put [Poisoned] on the nearest Townsfolk anticlockwise from the No Dashii',
				target: {
					choose: 'nearest-townsfolk-anticlockwise',
					choice: 'the nearest Townsfolk anticlockwise'
				},
				reason: 'The No Dashii’s Townsfolk neighbour is poisoned'
			},
			{
				label: 'Poisoned',
				text: 'Put [Poisoned] on the nearest Townsfolk clockwise from the No Dashii',
				target: {
					choose: 'nearest-townsfolk-clockwise',
					choice: 'the nearest Townsfolk clockwise'
				},
				reason: 'The No Dashii’s Townsfolk neighbour is poisoned'
			}
		]
	},
	{
		id: 'villageidiot',
		wiki: `${W}Village_Idiot`,
		reminders: [
			{
				label: 'Drunk',
				text: 'If multiple Village Idiots, mark one as [Drunk] on them',
				target: { choose: 'copies', choice: 'one of the Village Idiots' },
				reason: 'With more than one Village Idiot, one of them is drunk',
				when: { minCopies: 2 }
			}
		]
	},
	{
		id: 'lycanthrope',
		wiki: `${W}Lycanthrope`,
		reminders: [
			{
				label: 'Faux Paw',
				text: 'Choose a good player who registers as evil: put [Faux Paw] on them',
				target: { choose: 'good', choice: 'a good player' },
				reason: 'This good player registers as evil'
			}
		]
	},
	{
		id: 'alchemist',
		wiki: `${W}Alchemist`,
		reminders: [
			{
				label: 'Is The Alchemist',
				text: 'Choose the Alchemist’s Minion ability; if that Minion is not in play, put [Is The Alchemist] on them',
				target: self,
				reason: 'When their Minion ability is not in play, the Alchemist shows that Minion'
			}
		]
	},
	// Outsiders
	{
		id: 'drunk',
		wiki: `${W}Drunk`,
		reminders: [
			{
				label: 'Is The Drunk',
				text: 'Put [Is The Drunk] on the Drunk; choose a not-in-play Townsfolk they think they are',
				target: self,
				reason: 'The Drunk is shown a Townsfolk; this marks who really is the Drunk'
			}
		]
	},
	{
		id: 'puzzlemaster',
		wiki: `${W}Puzzlemaster`,
		reminders: [
			{
				label: 'Drunk',
				text: 'Choose who the Puzzlemaster makes drunk, usually a Townsfolk: put [Drunk] on them',
				target: { choose: 'townsfolk', choice: 'any player, usually a Townsfolk' },
				reason: 'The player the Puzzlemaster makes drunk'
			}
		]
	},
	// Minions
	{
		id: 'marionette',
		wiki: `${W}Marionette`,
		reminders: [
			{
				label: 'Is The Marionette',
				text: 'Put [Is The Marionette] on the Marionette, a neighbour of the Demon; choose a good character they think they are',
				target: self,
				reason: 'The Marionette thinks they are good; this marks who really is the Marionette'
			}
		]
	},
	{
		id: 'eviltwin',
		wiki: `${W}Evil_Twin`,
		reminders: [
			{
				label: 'Twin',
				text: 'Choose the Evil Twin’s good twin: put [Twin] on them',
				target: { choose: 'good', choice: 'a good player (rarely a Traveller)' },
				reason: 'The good twin; the twins learn each other'
			}
		]
	},
	{
		id: 'widow',
		wiki: `${W}Widow`,
		reminders: [
			{
				label: 'Know',
				text: 'Choose a good player who will learn a Widow is in play: put [Know] on them',
				target: { choose: 'good', choice: 'a good player' },
				reason: 'This good player learns a Widow is in play'
			}
		]
	},
	{
		id: 'xaan',
		wiki: `${W}Xaan`,
		reminders: [
			{
				label: 'Night 1',
				text: 'Put [Night 1] on the Xaan',
				target: self,
				reason: 'Counts the nights until night X'
			},
			{
				label: 'X',
				text: 'With 1 Outsider in play, also put [X] on the Xaan',
				target: self,
				reason: 'With 1 Outsider in play, night 1 is night X',
				when: { exactOutsiders: 1 }
			}
		]
	},
	{
		id: 'summoner',
		wiki: `${W}Summoner`,
		reminders: [
			{
				label: 'Night 1',
				text: 'Put [Night 1] on the Summoner',
				target: self,
				reason: 'Counts the nights until the Summoner chooses on night 3'
			}
		]
	},
	// Demons
	{
		id: 'riot',
		wiki: `${W}Riot`,
		reminders: [
			{
				label: 'Day 1',
				text: 'At the start of the first day, put [Day 1] on the Riot',
				target: self,
				reason: 'Counts the days until day 3',
				timing: 'first-day'
			}
		]
	},
	{
		id: 'leviathan',
		wiki: `${W}Leviathan`,
		reminders: [
			{
				label: 'Day 1',
				text: 'At the start of the first day, put [Day 1] on the Leviathan',
				target: self,
				reason: 'Counts the days; evil wins after day 5',
				timing: 'first-day'
			}
		]
	},
	// Travellers
	{
		id: 'apprentice',
		wiki: `${W}Apprentice`,
		reminders: [
			{
				label: 'Is The Apprentice',
				text: 'Choose the Apprentice’s Townsfolk (if good) or Minion (if evil) ability: put [Is The Apprentice] on them',
				target: self,
				reason: 'The Apprentice’s token is swapped for the ability they gain'
			}
		]
	},
	{
		id: 'gnome',
		wiki: `${W}Gnome`,
		reminders: [
			{
				label: 'Amigo',
				text: 'Choose a player of the Gnome’s alignment as their amigo: put [Amigo] on them',
				target: {
					choose: 'same-alignment',
					choice: 'a player of the Gnome’s alignment',
					notSelf: true
				},
				reason: 'Everyone learns this player'
			}
		]
	},
	// Fabled and Loric
	{
		id: 'revolutionary',
		wiki: `${W}Revolutionary`,
		reminders: [
			{
				label: 'Register Falsely?',
				text: 'Choose 2 neighbours of the same alignment as the Revolutionaries: put [Register Falsely?] between them',
				target: { choose: 'any', choice: 'between 2 neighbours of the same alignment' },
				reason: 'Marks the 2 Revolutionaries'
			}
		]
	},
	{
		id: 'angel',
		wiki: `${W}Angel`,
		reminders: [
			{
				label: 'Protected',
				text: 'Choose the new players the Angel protects: put [Protected] on each',
				target: { choose: 'any', choice: 'a new player who agrees to be protected' },
				reason: 'Use one token per protected player'
			}
		]
	},
	{
		id: 'stormcatcher',
		wiki: `${W}Stormcatcher`,
		reminders: [
			{
				label: 'Stormcaught',
				text: 'Name a good character as stormcaught; if they are in play, put [Stormcaught] on that player',
				target: { choose: 'good', choice: 'the player with the named character, if in play' },
				reason: 'This player can only die by execution; evil learns who'
			}
		]
	},
	{
		id: 'godofug',
		wiki: `${W}God_of_Ug`,
		reminders: [
			{
				label: 'Hat',
				text: 'Give the Ug hat to a player: put [Hat] on them',
				target: { choose: 'any', choice: 'any player' },
				reason: 'Who wears the Ug hat at the start'
			}
		]
	}
];

/** Why a character needs no setup reminder. */
const NONE = 'has no reminder tokens';
const CHOSEN = 'its tokens mark what a player chooses at night, placed when they choose';
const LATER = 'its tokens are only used after the first night or when something happens';

/** Every official character with no setup reminder, and why. */
export const NO_SETUP_REMINDERS: Record<CharacterId, string> = {
	...Object.fromEntries(
		[
			'chef',
			'clockmaker',
			'shugenja',
			'empath',
			'highpriestess',
			'general',
			'chambermaid',
			'king',
			'dreamer',
			'cultleader',
			'oracle',
			'savant',
			'alsaahir',
			'soldier',
			'farmer',
			'ravenkeeper',
			'sage',
			'choirboy',
			'mayor',
			'magician',
			'pacifist',
			'atheist',
			'recluse',
			'klutz',
			'saint',
			'mutant',
			'politician',
			'zealot',
			'snitch',
			'heretic',
			'spy',
			'pithag',
			'psychopath',
			'wraith',
			'boomdandy',
			'mastermind',
			'vizier',
			'boffin',
			'baron',
			'butcher',
			'gunslinger',
			'matron',
			'gangster',
			'beggar',
			'deviant',
			'scapegoat',
			'voudon',
			'buddhist',
			'djinn',
			'doomsayer',
			'ferryman',
			'fiddler',
			'sentinel',
			'bigwig',
			'gardener',
			'hindu',
			'knaves',
			'pope',
			'tor'
		].map((id) => [id, NONE])
	),
	...Object.fromEntries(
		[
			'preacher',
			'snakecharmer',
			'engineer',
			'nightwatchman',
			'courtier',
			'seamstress',
			'philosopher',
			'butler',
			'ogre',
			'poisoner',
			'devilsadvocate',
			'harpy',
			'witch',
			'cerenovus',
			'fearmonger',
			'organgrinder',
			'pukka',
			'kazali',
			'lleech',
			'thief',
			'bureaucrat'
		].map((id) => [id, CHOSEN])
	),
	...Object.fromEntries(
		[
			'mathematician',
			'flowergirl',
			'towncrier',
			'undertaker',
			'innkeeper',
			'monk',
			'gambler',
			'acrobat',
			'exorcist',
			'gossip',
			'professor',
			'artist',
			'slayer',
			'fisherman',
			'princess',
			'juggler',
			'cannibal',
			'minstrel',
			'banshee',
			'tealady',
			'fool',
			'virgin',
			'poppygrower',
			'goon',
			'tinker',
			'golem',
			'sweetheart',
			'plaguedoctor',
			'moonchild',
			'barber',
			'hatter',
			'mezepheles',
			'godfather',
			'assassin',
			'wizard',
			'goblin',
			'scarletwoman',
			'yaggababble',
			'imp',
			'shabaloth',
			'ojo',
			'po',
			'zombuul',
			'vigormortis',
			'vortox',
			'legion',
			'fanggu',
			'lordoftyphon',
			'alhadikhia',
			'harlot',
			'cacklejack',
			'bonecollector',
			'judge',
			'bishop',
			'deusexfiasco',
			'duchess',
			'fibbin',
			'hellslibrarian',
			'spiritofivory',
			'toymaker',
			'bootlegger',
			'ventriloquist'
		].map((id) => [id, LATER])
	),
	// Checked one by one: none of these has a token the Storyteller places at setup.
	sailor: 'its Drunk token marks the Sailor’s own night choice, placed when they choose',
	huntsman: 'No Ability goes on only when the Huntsman uses their ability',
	damsel: 'Minions are shown the Damsel token; Guess Used is only for a wrong guess',
	lunatic:
		'the Lunatic’s character token is in the grimoire; Chosen marks their later night attacks',
	lilmonsta: 'the Minions choose the babysitter on the first night',
	barista: 'the Storyteller picks a player and one of two effects each night, then marks it',
	amnesiac: 'the ? tokens are optional notes on the Amnesiac’s ability',
	hermit: 'the 1, 2, 3 tokens stand in for other Outsiders’ tokens when needed',
	zenomancer: 'goals can be handed out at any time; mark a player with Goal when they get one'
};

/**
 * Other preparation after the characters are drawn and before the first night that is
 * not a token placement (or only an optional one): words to choose, abilities to pick,
 * bluffs to set aside. `tokens` names any reminder the step may use.
 */
export interface SetupNote {
	text: string;
	tokens?: readonly string[];
	/**
	 * A value the Storyteller types in during prep and the app shows later (the
	 * Yaggababble's phrase in its pre-day reminder): stored as `Game.prepValues`.
	 */
	value?: { key: string; label: string };
}

export const SETUP_NOTES: Record<CharacterId, readonly SetupNote[]> = {
	bountyhunter: [{ text: 'Choose a Townsfolk player who is evil; turn their token upside down' }],
	huntsman: [{ text: 'If the Damsel is not in play, add her in place of a Townsfolk' }],
	lunatic: [
		{
			text: 'Choose the Demon the Lunatic thinks they are; with 7 or more players, also choose fake Minions and 3 bluffs to show them'
		}
	],
	summoner: [{ text: 'Choose 3 not-in-play good characters as the Summoner’s bluffs' }],
	mezepheles: [{ text: 'Choose the Mezepheles’ secret word' }],
	yaggababble: [
		{
			text: 'Choose the Yaggababble’s secret phrase',
			value: { key: 'phrase', label: 'Secret phrase' }
		}
	],
	amnesiac: [{ text: 'Decide what the Amnesiac’s ability is; note it with [?]', tokens: ['?'] }],
	lordoftyphon: [
		{ text: 'Check the evil players sit in a line with the Lord of Typhon in the middle' }
	],
	zenomancer: [
		{
			text: 'Choose goals for one or more players: put [Goal] on each (or hand them out later)',
			tokens: ['Goal']
		}
	]
};
