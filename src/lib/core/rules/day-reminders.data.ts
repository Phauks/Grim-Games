/**
 * Pre-day reminders, curated (Trevor reviews and approves this list).
 *
 * One entry per official character with something to watch during the day. Each reminder
 * is a short, state-based sentence built from segments:
 * - `{ self: true }`: this character, shown as a badge ("[Witch · Sam]");
 * - `{ target: true }`: the character of the player carrying the reminder token named in
 *   `when.reminder` ("[Librarian · Alex]");
 * - `{ text }`: our own words, kept short.
 *
 * `when` says when the reminder shows:
 * - `self: 'alive' | 'dead' | 'any'` (default 'alive');
 * - `reminder`: only while this character's reminder token (TPI's name) is on a player;
 *   one reminder per player carrying it;
 * - `noReminder`: only while that token is NOT on any player ("No Ability": not used yet);
 * - `cause`: with `self: 'dead'`, only if the death's cause is one of these ('demon' also
 *   matches any Demon's id). An unknown cause counts as a match, flagged `uncertain`.
 *   The app does not track day or night, so nothing here depends on the day number.
 * - `minAlive`: only while at least this many players are alive.
 *
 * `impairable: true` adds "[Slayer] is poisoned" / "[Slayer] is drunk" whenever a Poisoned
 * or Drunk token sits on that player: the ability matters today, so the Storyteller must
 * remember it may not work.
 *
 * Wiki: each `wiki` is the character's page; text here is our summary, never wiki prose.
 * Characters with nothing to watch by day are in `NO_DAY_RELEVANCE` (a test checks every
 * official character is in exactly one of the two lists).
 */
import type { CharacterId } from '#lib/core/data/types.ts';

export const DAY_GROUPS = [
	'day-ability',
	'nomination',
	'vote',
	'execution-death',
	'madness',
	'announcement'
] as const;
export type DayGroup = (typeof DAY_GROUPS)[number];

export const DAY_GROUP_TITLES: Record<DayGroup, string> = {
	'day-ability': 'Day abilities',
	nomination: 'Nominations',
	vote: 'Voting',
	'execution-death': 'Executions and deaths',
	madness: 'Madness',
	announcement: 'Public knowledge'
};

/**
 * `value`: a value the Storyteller entered during prep (`SetupNote.value`, stored on the
 * game as `prepValues`), shown as `placeholder` until entered (the Yaggababble's phrase).
 */
export type TemplateSegment =
	| { self: true }
	| { target: true }
	| { text: string }
	| { value: string; placeholder: string };

/** How a death is matched: a cause the app records, or a character id. */
export type DeathCauseMatch = 'execution' | 'demon' | 'other' | CharacterId;

export interface DayCondition {
	self?: 'alive' | 'dead' | 'any';
	reminder?: string;
	noReminder?: string;
	cause?: readonly DeathCauseMatch[];
	minAlive?: number;
}

export interface DayReminderSpec {
	group: DayGroup;
	template: readonly TemplateSegment[];
	when?: DayCondition;
}

export interface DayReminderEntry {
	id: CharacterId;
	wiki: string;
	impairable?: boolean;
	reminders: readonly DayReminderSpec[];
}

const W = 'https://wiki.bloodontheclocktower.com/';
const self = { self: true } as const;
const target = { target: true } as const;
const t = (text: string) => ({ text });

/** `[self] text`, the most common shape. */
const is = (group: DayGroup, text: string, when?: DayCondition): DayReminderSpec => ({
	group,
	template: [self, t(text)],
	...(when ? { when } : {})
});
/** `[self] text [target]`, for a reminder token on another player. */
const on = (
	group: DayGroup,
	text: string,
	reminder: string,
	when?: DayCondition
): DayReminderSpec => ({
	group,
	template: [self, t(text), target],
	when: { reminder, ...when }
});

export const DAY_REMINDER_ENTRIES: readonly DayReminderEntry[] = [
	// ── Townsfolk ──
	{
		id: 'pixie',
		wiki: `${W}Pixie`,
		reminders: [
			{
				group: 'madness',
				template: [self, t('must be mad as'), target, t('to gain their ability when they die.')],
				when: { reminder: 'Mad' }
			}
		]
	},
	{
		id: 'sailor',
		wiki: `${W}Sailor`,
		impairable: true,
		reminders: [is('execution-death', 'cannot die.')]
	},
	{
		id: 'cultleader',
		wiki: `${W}Cult_Leader`,
		impairable: true,
		reminders: [is('day-ability', 'may call a cult vote')]
	},
	{
		id: 'flowergirl',
		wiki: `${W}Flowergirl`,
		reminders: [is('vote', 'is watching for a Demon vote')]
	},
	{
		id: 'towncrier',
		wiki: `${W}Town_Crier`,
		reminders: [is('nomination', 'is watching for a Minion nomination')]
	},
	{
		id: 'undertaker',
		wiki: `${W}Undertaker`,
		reminders: [is('execution-death', 'will learn today’s executee')]
	},
	{
		id: 'gossip',
		wiki: `${W}Gossip`,
		impairable: true,
		reminders: [is('day-ability', 'may make a statement')]
	},
	{
		id: 'savant',
		wiki: `${W}Savant`,
		impairable: true,
		reminders: [is('day-ability', 'may visit you')]
	},
	{
		id: 'alsaahir',
		wiki: `${W}Alsaahir`,
		impairable: true,
		reminders: [is('day-ability', 'may guess the evil team')]
	},
	{
		id: 'artist',
		wiki: `${W}Artist`,
		impairable: true,
		reminders: [is('day-ability', 'may ask a question', { noReminder: 'No Ability' })]
	},
	{
		id: 'slayer',
		wiki: `${W}Slayer`,
		impairable: true,
		reminders: [is('day-ability', 'has an unused shot', { noReminder: 'No Ability' })]
	},
	{
		id: 'fisherman',
		wiki: `${W}Fisherman`,
		impairable: true,
		reminders: [is('day-ability', 'may ask for advice', { noReminder: 'No Ability' })]
	},
	{
		id: 'princess',
		wiki: `${W}Princess`,
		impairable: true,
		reminders: [is('nomination', 'may stop tonight’s Demon kill', { noReminder: "Doesn't Kill" })]
	},
	{
		id: 'juggler',
		wiki: `${W}Juggler`,
		impairable: true,
		reminders: [is('day-ability', 'may juggle', { noReminder: 'Correct' })]
	},
	{
		id: 'alchemist',
		wiki: `${W}Alchemist`,
		impairable: true,
		reminders: [is('day-ability', 'has a Minion ability')]
	},
	{
		id: 'cannibal',
		wiki: `${W}Cannibal`,
		impairable: true,
		reminders: [on('execution-death', 'has the ability of', 'Lunch')]
	},
	{
		id: 'amnesiac',
		wiki: `${W}Amnesiac`,
		impairable: true,
		reminders: [is('day-ability', 'may guess their ability')]
	},
	{
		id: 'minstrel',
		wiki: `${W}Minstrel`,
		impairable: true,
		reminders: [
			is('execution-death', 'is alive'),
			is('execution-death', 'has made everyone drunk', {
				self: 'any',
				reminder: 'Everyone Is Drunk'
			})
		]
	},
	{
		id: 'banshee',
		wiki: `${W}Banshee`,
		reminders: [is('vote', 'may nominate and vote twice', { self: 'dead', cause: ['demon'] })]
	},
	{
		id: 'tealady',
		wiki: `${W}Tea_Lady`,
		impairable: true,
		reminders: [on('execution-death', 'protects', 'Cannot Die')]
	},
	{
		id: 'mayor',
		wiki: `${W}Mayor`,
		impairable: true,
		reminders: [is('execution-death', 'is alive')]
	},
	{
		id: 'fool',
		wiki: `${W}Fool`,
		impairable: true,
		reminders: [is('execution-death', 'has not died yet', { noReminder: 'No Ability' })]
	},
	{
		id: 'virgin',
		wiki: `${W}Virgin`,
		impairable: true,
		reminders: [is('nomination', 'has not been nominated', { noReminder: 'No Ability' })]
	},
	{
		id: 'pacifist',
		wiki: `${W}Pacifist`,
		impairable: true,
		reminders: [is('execution-death', 'is alive')]
	},
	{
		id: 'atheist',
		wiki: `${W}Atheist`,
		reminders: [is('nomination', 'is in play: you can be nominated', { self: 'any' })]
	},
	// ── Outsiders ──
	{
		id: 'hermit',
		wiki: `${W}Hermit`,
		impairable: true,
		reminders: [is('execution-death', 'has every Outsider ability')]
	},
	{
		id: 'butler',
		wiki: `${W}Butler`,
		impairable: true,
		reminders: [on('vote', 'has chosen', 'Master')]
	},
	{ id: 'tinker', wiki: `${W}Tinker`, reminders: [is('execution-death', 'is alive')] },
	{
		id: 'golem',
		wiki: `${W}Golem`,
		impairable: true,
		reminders: [is('nomination', 'has not nominated', { noReminder: 'May Not Nominate' })]
	},
	{ id: 'sweetheart', wiki: `${W}Sweetheart`, reminders: [is('execution-death', 'is alive')] },
	{ id: 'plaguedoctor', wiki: `${W}Plague_Doctor`, reminders: [is('execution-death', 'is alive')] },
	{
		id: 'klutz',
		wiki: `${W}Klutz`,
		reminders: [is('execution-death', 'is dead', { self: 'dead' })]
	},
	{
		id: 'moonchild',
		wiki: `${W}Moonchild`,
		reminders: [is('execution-death', 'is dead', { self: 'dead' })]
	},
	{
		id: 'saint',
		wiki: `${W}Saint`,
		impairable: true,
		reminders: [is('execution-death', 'is alive')]
	},
	{ id: 'barber', wiki: `${W}Barber`, reminders: [is('execution-death', 'is alive')] },
	{ id: 'hatter', wiki: `${W}Hatter`, reminders: [is('execution-death', 'is alive')] },
	{
		id: 'mutant',
		wiki: `${W}Mutant`,
		impairable: true,
		reminders: [is('madness', 'must not claim Outsider')]
	},
	{
		id: 'zealot',
		wiki: `${W}Zealot`,
		impairable: true,
		reminders: [is('vote', 'must vote', { minAlive: 5 })]
	},
	{
		id: 'damsel',
		wiki: `${W}Damsel`,
		reminders: [is('announcement', 'has not been guessed', { noReminder: 'Guess Used' })]
	},
	{
		id: 'heretic',
		wiki: `${W}Heretic`,
		reminders: [is('execution-death', 'is in play', { self: 'any' })]
	},
	{
		id: 'puzzlemaster',
		wiki: `${W}Puzzlemaster`,
		impairable: true,
		reminders: [is('day-ability', 'has an unused guess', { noReminder: 'Guess Used' })]
	},
	{
		id: 'politician',
		wiki: `${W}Politician`,
		reminders: [is('execution-death', 'is in play', { self: 'any' })]
	},
	// ── Minions ──
	{
		id: 'mezepheles',
		wiki: `${W}Mezepheles`,
		impairable: true,
		reminders: [is('day-ability', 'has a secret word', { noReminder: 'Turns Evil' })]
	},
	{ id: 'godfather', wiki: `${W}Godfather`, reminders: [is('execution-death', 'is alive')] },
	{
		id: 'devilsadvocate',
		wiki: `${W}Devil%27s_Advocate`,
		impairable: true,
		reminders: [on('execution-death', 'has protected', 'Survives Execution')]
	},
	{
		id: 'harpy',
		wiki: `${W}Harpy`,
		impairable: true,
		reminders: [on('madness', 'has made mad', 'Mad')]
	},
	{
		id: 'witch',
		wiki: `${W}Witch`,
		impairable: true,
		reminders: [on('nomination', 'has chosen', 'Cursed')]
	},
	{
		id: 'cerenovus',
		wiki: `${W}Cerenovus`,
		impairable: true,
		reminders: [on('madness', 'has made mad', 'Mad')]
	},
	{
		id: 'fearmonger',
		wiki: `${W}Fearmonger`,
		impairable: true,
		reminders: [on('execution-death', 'has chosen', 'Fear')]
	},
	{
		id: 'pithag',
		wiki: `${W}Pit-Hag`,
		reminders: [is('day-ability', 'may have changed characters')]
	},
	{
		id: 'psychopath',
		wiki: `${W}Psychopath`,
		impairable: true,
		reminders: [is('day-ability', 'may kill before nominations'), is('execution-death', 'is alive')]
	},
	{
		id: 'wizard',
		wiki: `${W}Wizard`,
		impairable: true,
		reminders: [is('day-ability', 'may make a wish')]
	},
	{
		id: 'xaan',
		wiki: `${W}Xaan`,
		reminders: [is('day-ability', 'has poisoned the Townsfolk', { self: 'any', reminder: 'X' })]
	},
	{
		id: 'eviltwin',
		wiki: `${W}Evil_Twin`,
		impairable: true,
		reminders: [on('execution-death', 'is twinned with', 'Twin')]
	},
	{
		id: 'goblin',
		wiki: `${W}Goblin`,
		impairable: true,
		reminders: [is('nomination', 'has claimed', { reminder: 'Claimed' })]
	},
	{
		id: 'boomdandy',
		wiki: `${W}Boomdandy`,
		impairable: true,
		reminders: [is('execution-death', 'is alive')]
	},
	{
		id: 'mastermind',
		wiki: `${W}Mastermind`,
		impairable: true,
		reminders: [is('execution-death', 'is alive')]
	},
	{
		id: 'scarletwoman',
		wiki: `${W}Scarlet_Woman`,
		impairable: true,
		reminders: [is('execution-death', 'is alive', { minAlive: 5 })]
	},
	{
		id: 'vizier',
		wiki: `${W}Vizier`,
		impairable: true,
		reminders: [is('announcement', 'is known to all'), is('vote', 'is alive')]
	},
	{
		id: 'organgrinder',
		wiki: `${W}Organ_Grinder`,
		impairable: true,
		reminders: [is('vote', 'is alive')]
	},
	{
		id: 'boffin',
		wiki: `${W}Boffin`,
		reminders: [is('day-ability', 'gave the Demon a good ability')]
	},
	// ── Demons ──
	{
		id: 'yaggababble',
		wiki: `${W}Yaggababble`,
		impairable: true,
		reminders: [
			{
				group: 'day-ability',
				template: [self, t('secret phrase is'), { value: 'phrase', placeholder: 'PHRASE' }]
			}
		]
	},
	{
		id: 'zombuul',
		wiki: `${W}Zombuul`,
		reminders: [is('execution-death', 'is alive', { self: 'any' })]
	},
	{ id: 'vortox', wiki: `${W}Vortox`, reminders: [is('execution-death', 'is alive')] },
	{ id: 'legion', wiki: `${W}Legion`, reminders: [is('vote', 'is alive')] },
	{
		id: 'lleech',
		wiki: `${W}Lleech`,
		reminders: [on('execution-death', 'has chosen', 'Poisoned')]
	},
	{
		id: 'riot',
		wiki: `${W}Riot`,
		reminders: [is('nomination', 'is rioting', { reminder: 'Day 3' })]
	},
	{
		id: 'leviathan',
		wiki: `${W}Leviathan`,
		reminders: [
			is('announcement', 'is in play'),
			is('execution-death', 'has seen a good player executed', { reminder: 'Good Player Executed' })
		]
	},
	// ── Travellers ──
	{
		id: 'thief',
		wiki: `${W}Thief`,
		impairable: true,
		reminders: [on('vote', 'has chosen', 'Negative Vote')]
	},
	{
		id: 'bureaucrat',
		wiki: `${W}Bureaucrat`,
		impairable: true,
		reminders: [on('vote', 'has chosen', '3 Votes')]
	},
	{
		id: 'butcher',
		wiki: `${W}Butcher`,
		impairable: true,
		reminders: [is('nomination', 'may nominate again')]
	},
	{
		id: 'cacklejack',
		wiki: `${W}Cacklejack`,
		impairable: true,
		reminders: [is('day-ability', 'may choose a player')]
	},
	{
		id: 'gunslinger',
		wiki: `${W}Gunslinger`,
		impairable: true,
		reminders: [is('vote', 'may shoot a voter')]
	},
	{
		id: 'matron',
		wiki: `${W}Matron`,
		impairable: true,
		reminders: [is('day-ability', 'may swap seats')]
	},
	{
		id: 'gangster',
		wiki: `${W}Gangster`,
		impairable: true,
		reminders: [is('day-ability', 'may kill a neighbour')]
	},
	{
		id: 'judge',
		wiki: `${W}Judge`,
		impairable: true,
		reminders: [is('execution-death', 'has an unused ruling', { noReminder: 'No Ability' })]
	},
	{ id: 'beggar', wiki: `${W}Beggar`, reminders: [is('vote', 'needs a vote token')] },
	{
		id: 'deviant',
		wiki: `${W}Deviant`,
		impairable: true,
		reminders: [is('execution-death', 'is alive')]
	},
	{
		id: 'scapegoat',
		wiki: `${W}Scapegoat`,
		impairable: true,
		reminders: [is('execution-death', 'is alive')]
	},
	{
		id: 'gnome',
		wiki: `${W}Gnome`,
		impairable: true,
		reminders: [on('nomination', 'protects', 'Amigo')]
	},
	{ id: 'bishop', wiki: `${W}Bishop`, impairable: true, reminders: [is('nomination', 'is alive')] },
	{ id: 'voudon', wiki: `${W}Voudon`, impairable: true, reminders: [is('vote', 'is alive')] },
	// ── Fabled ──
	{
		id: 'angel',
		wiki: `${W}Angel`,
		reminders: [on('execution-death', 'protects', 'Protected', { self: 'any' })]
	},
	{
		id: 'buddhist',
		wiki: `${W}Buddhist`,
		reminders: [is('announcement', 'is in play', { self: 'any' })]
	},
	{
		id: 'deusexfiasco',
		wiki: `${W}Deus_ex_Fiasco`,
		reminders: [is('announcement', 'has not happened yet', { self: 'any', noReminder: 'Whoopsie' })]
	},
	{
		id: 'djinn',
		wiki: `${W}Djinn`,
		reminders: [is('announcement', 'is in play', { self: 'any' })]
	},
	{
		id: 'doomsayer',
		wiki: `${W}Doomsayer`,
		reminders: [is('day-ability', 'is in play', { self: 'any', minAlive: 4 })]
	},
	{
		id: 'duchess',
		wiki: `${W}Duchess`,
		reminders: [is('day-ability', 'is taking visitors', { self: 'any' })]
	},
	{ id: 'ferryman', wiki: `${W}Ferryman`, reminders: [is('vote', 'is in play', { self: 'any' })] },
	{
		id: 'fiddler',
		wiki: `${W}Fiddler`,
		reminders: [is('day-ability', 'is in play', { self: 'any' })]
	},
	{
		id: 'hellslibrarian',
		wiki: `${W}Hell%27s_Librarian`,
		reminders: [is('announcement', 'is in play', { self: 'any' })]
	},
	// ── Loric ──
	{
		id: 'bigwig',
		wiki: `${W}Big_Wig`,
		reminders: [is('nomination', 'is in play', { self: 'any' })]
	},
	{
		id: 'bootlegger',
		wiki: `${W}Bootlegger`,
		reminders: [is('announcement', 'is in play', { self: 'any' })]
	},
	{
		id: 'godofug',
		wiki: `${W}God_of_Ug`,
		reminders: [on('vote', 'hat is on', 'Hat', { self: 'any' })]
	},
	{
		id: 'hindu',
		wiki: `${W}Hindu`,
		reminders: [is('execution-death', 'is in play', { self: 'any' })]
	},
	{
		id: 'stormcatcher',
		wiki: `${W}Storm_Catcher`,
		reminders: [on('execution-death', 'protects', 'Stormcaught', { self: 'any' })]
	},
	{ id: 'tor', wiki: `${W}Tor`, reminders: [is('execution-death', 'is in play', { self: 'any' })] },
	{
		id: 'ventriloquist',
		wiki: `${W}Ventriloquist`,
		reminders: [on('madness', 'has made mad', 'Mad', { self: 'any' })]
	},
	{
		id: 'zenomancer',
		wiki: `${W}Zenomancer`,
		reminders: [on('day-ability', 'has set a goal for', 'Goal', { self: 'any' })]
	}
];

/**
 * Official characters deliberately left out, each with a few-word reason: their abilities
 * act at night or at setup, or only change information given at night.
 */
export const NO_DAY_RELEVANCE: Readonly<Record<CharacterId, string>> = {
	// Townsfolk
	steward: 'first-night info',
	knight: 'first-night info',
	chef: 'first-night info',
	noble: 'first-night info',
	investigator: 'first-night info',
	washerwoman: 'first-night info',
	clockmaker: 'first-night info',
	grandmother: 'night info and night death',
	librarian: 'first-night info',
	shugenja: 'first-night info',
	bountyhunter: 'night info; setup change',
	empath: 'night info',
	highpriestess: 'night info',
	balloonist: 'night info; setup change',
	general: 'night info',
	preacher: 'night action',
	chambermaid: 'night info',
	villageidiot: 'night info; setup change',
	snakecharmer: 'night action',
	mathematician: 'night info',
	king: 'night info',
	dreamer: 'night info',
	fortuneteller: 'night info',
	oracle: 'night info',
	innkeeper: 'night protection',
	monk: 'night protection',
	gambler: 'night action',
	acrobat: 'night action',
	exorcist: 'night action',
	lycanthrope: 'night action',
	engineer: 'night action',
	nightwatchman: 'night action',
	courtier: 'night action',
	seamstress: 'night info',
	philosopher: 'night action',
	huntsman: 'night action; setup change',
	professor: 'night action',
	soldier: 'Demon protection only',
	farmer: 'triggers on night death',
	ravenkeeper: 'triggers on night death',
	sage: 'triggers on Demon kill',
	choirboy: 'triggers on Demon kill',
	magician: 'changes evil info',
	poppygrower: 'changes evil info',
	// Outsiders
	goon: 'night effect',
	ogre: 'first-night choice',
	lunatic: 'night effect',
	drunk: 'setup only',
	recluse: 'registration only',
	snitch: 'first-night bluffs',
	// Minions
	poisoner: 'night action',
	spy: 'night action',
	assassin: 'night action',
	widow: 'first-night action',
	marionette: 'setup only',
	wraith: 'night action',
	summoner: 'night action; setup change',
	baron: 'setup only',
	// Demons
	pukka: 'night kills',
	lilmonsta: 'night kills; setup change',
	nodashii: 'night kills',
	imp: 'night kills',
	shabaloth: 'night kills',
	ojo: 'night kills',
	kazali: 'night kills; setup change',
	po: 'night kills',
	vigormortis: 'night kills; setup change',
	fanggu: 'night kills; setup change',
	lordoftyphon: 'night kills; setup change',
	alhadikhia: 'night kills',
	// Travellers
	barista: 'night action',
	harlot: 'night action',
	bonecollector: 'night action',
	apprentice: 'first-night action',
	// Fabled
	fibbin: 'changes night info',
	revolutionary: 'registration only',
	sentinel: 'setup only',
	spiritofivory: 'Storyteller limit',
	toymaker: 'night rule',
	// Loric
	gardener: 'setup only',
	knaves: 'Storyteller rule',
	pope: 'setup only'
};
