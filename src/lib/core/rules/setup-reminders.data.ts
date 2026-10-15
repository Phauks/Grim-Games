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
 * - `copies`: one of the players who have this character (Village Idiots).
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
	| 'copies';

export type SetupTarget =
	{ self: true } | { choose: SeatFilter; choice: string; notSelf?: boolean };

export interface SetupCondition {
	minOutsiders?: number;
	exactOutsiders?: number;
	minCopies?: number;
}

export interface SetupReminderSpec {
	label: string;
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
				target: { choose: 'townsfolk', choice: 'a Townsfolk player', notSelf: true },
				reason: 'Marks the Townsfolk the Washerwoman learns about'
			},
			{
				label: 'Wrong',
				target: { choose: 'any', choice: 'any other player', notSelf: true },
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
				target: { choose: 'outsider', choice: 'an Outsider player', notSelf: true },
				reason: 'Marks the Outsider the Librarian learns about (none in play: they learn 0)',
				when: { minOutsiders: 1 }
			},
			{
				label: 'Wrong',
				target: { choose: 'any', choice: 'any other player', notSelf: true },
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
				target: { choose: 'minion', choice: 'a Minion player', notSelf: true },
				reason: 'Marks the Minion the Investigator learns about'
			},
			{
				label: 'Wrong',
				target: { choose: 'any', choice: 'any other player', notSelf: true },
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
				target: { choose: 'not-demon', choice: 'a player who isn’t the Demon', notSelf: true },
				reason: 'First of the 2 players the Knight is shown'
			},
			{
				label: 'Know',
				target: {
					choose: 'not-demon',
					choice: 'another player who isn’t the Demon',
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
				target: { choose: 'evil', choice: 'an evil player' },
				reason: 'The one evil player among the 3 the Noble is shown'
			},
			{
				label: 'Know',
				target: { choose: 'good', choice: 'a good player', notSelf: true },
				reason: 'A good player among the 3 the Noble is shown'
			},
			{
				label: 'Know',
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
				target: { choose: 'any', choice: 'any player' },
				reason: 'The player the Balloonist is shown on the first night'
			}
		]
	},
	{
		id: 'villageidiot',
		wiki: `${W}Village_Idiot`,
		reminders: [
			{
				label: 'Drunk',
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
				target: self,
				reason: 'Counts the nights until night X'
			},
			{
				label: 'X',
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
			'nodashii',
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
