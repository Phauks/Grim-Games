/**
 * Which reminder tokens should stay on the seat they were first placed on (Trevor,
 * 2026-10-16: "token integrity").
 *
 * A token is FIXED when it records something decided once: setup or first-night
 * information ("start knowing"), a once-per-game effect, or the character's own spent
 * ability. Moving a fixed token to another player rewrites what happened, so the app asks
 * first. A token is MOVING when the ability places it again on a new choice (each night,
 * each day, a counter, a death marker for tonight), so moving it is routine.
 *
 * The Storyteller can still move any token: a fixed token's move is a warning, never a
 * refusal (the app suggests and warns, never locks).
 *
 * Every official character with reminder tokens is in exactly one list (a test checks
 * this). In `FIXED_REMINDERS`, the labels listed are fixed and the character's other
 * labels move. `why` is our own summary, never wiki prose; the character's wiki page is
 * `wikiUrl(character)`. Basis: each character's ability text in TPI's data and its wiki
 * page; homebrew tokens are never fixed.
 */
import type { CharacterId } from '#lib/core/data/types.ts';

export interface FixedReminders {
	labels: readonly string[];
	why: string;
}

const START_KNOWING = 'Marks the information the player started knowing.';
const SPENT = 'Marks that this character has used its once-per-game ability.';
const OWN_STATE = 'Marks this character’s own state, so it stays on its seat.';

export const FIXED_REMINDERS: Record<CharacterId, FixedReminders> = {
	steward: { labels: ['Know'], why: START_KNOWING },
	knight: { labels: ['Know'], why: START_KNOWING },
	noble: { labels: ['Know'], why: START_KNOWING },
	investigator: { labels: ['Minion', 'Wrong'], why: START_KNOWING },
	washerwoman: { labels: ['Townsfolk', 'Wrong'], why: START_KNOWING },
	librarian: { labels: ['Outsider', 'Wrong'], why: START_KNOWING },
	grandmother: {
		labels: ['Grandchild'],
		why: 'The grandchild is shown once; Dead marks tonight’s death and moves.'
	},
	pixie: {
		labels: ['Mad', 'Has Ability'],
		why: 'The Townsfolk shown is chosen once at the start.'
	},
	preacher: {
		labels: ['No Ability'],
		why: 'Each Minion the Preacher finds keeps the token for the rest of the game.'
	},
	villageidiot: { labels: ['Drunk'], why: 'The drunk Village Idiot is decided at setup.' },
	snakecharmer: {
		labels: ['Poisoned'],
		why: 'The old Demon stays poisoned after the swap, whatever happens next.'
	},
	fortuneteller: { labels: ['Red Herring'], why: 'The red herring is chosen once at setup.' },
	flowergirl: { labels: ['Demon Voted', 'Demon Not Voted'], why: OWN_STATE },
	towncrier: { labels: ['Minions Not Nominated', 'Minion Nominated'], why: OWN_STATE },
	lycanthrope: {
		labels: ['Faux Paw'],
		why: 'The good player who registers as evil is chosen once.'
	},
	engineer: { labels: ['No Ability'], why: SPENT },
	nightwatchman: { labels: ['No Ability'], why: SPENT },
	courtier: {
		labels: ['Drunk 3', 'Drunk 2', 'Drunk 1', 'No Ability'],
		why: 'The chosen character is drunk for three days; the choice is made once.'
	},
	seamstress: { labels: ['No Ability'], why: SPENT },
	philosopher: {
		labels: ['Drunk', 'Is The Philosopher'],
		why: 'The choice is made once; its drunk player and the Philosopher stay marked.'
	},
	huntsman: { labels: ['No Ability'], why: SPENT },
	professor: { labels: ['Alive', 'No Ability'], why: SPENT },
	artist: { labels: ['No Ability'], why: SPENT },
	slayer: { labels: ['No Ability'], why: SPENT },
	fisherman: { labels: ['No Ability'], why: SPENT },
	princess: {
		labels: ["Doesn't Kill"],
		why: 'Placed once, on the Demon, after the Princess’s nominee dies.'
	},
	juggler: { labels: ['Correct'], why: 'The guesses are made once, on the first day.' },
	alchemist: { labels: ['Is The Alchemist'], why: 'Marks which player is the Alchemist.' },
	banshee: { labels: ['Has Ability'], why: OWN_STATE },
	fool: { labels: ['No Ability'], why: SPENT },
	virgin: { labels: ['No Ability'], why: SPENT },
	poppygrower: { labels: ['Evil Wakes'], why: OWN_STATE },
	ogre: { labels: ['Friend'], why: 'The Ogre’s friend is chosen once, on the first night.' },
	drunk: { labels: ['Is The Drunk'], why: 'Marks which player is the Drunk.' },
	golem: { labels: ['May Not Nominate'], why: SPENT },
	sweetheart: {
		labels: ['Drunk'],
		why: 'One player becomes drunk once, when the Sweetheart dies.'
	},
	plaguedoctor: {
		labels: ['Storyteller Ability'],
		why: 'A Minion gains the ability once, when the Plague Doctor dies.'
	},
	damsel: { labels: ['Guess Used'], why: SPENT },
	puzzlemaster: {
		labels: ['Drunk', 'Guess Used'],
		why: 'The drunk player is decided at setup; the guess is once per game.'
	},
	mezepheles: {
		labels: ['Turns Evil', 'No Ability'],
		why: 'Only the first player to say the word turns evil.'
	},
	assassin: { labels: ['No Ability'], why: SPENT },
	widow: {
		labels: ['Poisoned', 'Know'],
		why: 'The Widow poisons once, on the first night, and one good player learns of her.'
	},
	marionette: { labels: ['Is The Marionette'], why: 'Marks which player is the Marionette.' },
	eviltwin: { labels: ['Twin'], why: 'The twin is chosen once at setup.' },
	scarletwoman: { labels: ['Is The Demon'], why: 'Marks that the Scarlet Woman became the Demon.' },
	lleech: { labels: ['Poisoned'], why: 'The host is chosen once, on the first night.' },
	vigormortis: {
		labels: ['Has Ability', 'Poisoned'],
		why: 'A killed Minion keeps its ability, and its Townsfolk neighbour stays poisoned.'
	},
	fanggu: { labels: ['Once'], why: SPENT },
	leviathan: { labels: ['Good Player Executed'], why: OWN_STATE },
	bonecollector: { labels: ['No Ability', 'Has Ability'], why: SPENT },
	judge: { labels: ['No Ability'], why: SPENT },
	apprentice: { labels: ['Is The Apprentice'], why: 'Marks which player is the Apprentice.' },
	gnome: { labels: ['Amigo'], why: 'The amigo is chosen once, on the first night.' },
	angel: {
		labels: ['Protected', 'Something Bad'],
		why: 'The protected players are chosen at setup.'
	},
	deusexfiasco: { labels: ['Whoopsie'], why: OWN_STATE },
	fibbin: { labels: ['No Ability'], why: SPENT },
	hellslibrarian: { labels: ['Something Bad'], why: OWN_STATE },
	revolutionary: {
		labels: ['Register Falsely?', 'Aligned'],
		why: 'The pair of neighbours is chosen at setup.'
	},
	spiritofivory: { labels: ['No More Evil'], why: OWN_STATE },
	toymaker: { labels: ['Final Night: No Attack'], why: OWN_STATE },
	godofug: { labels: ['Hat'], why: 'The player with the hat is chosen at setup.' },
	stormcatcher: { labels: ['Stormcaught'], why: 'The stormcaught character is chosen at setup.' },
	zenomancer: { labels: ['Goal'], why: 'Each player’s goal is set at the start.' }
};

const EACH_NIGHT = 'Placed on a new choice each night.';
const DEATHS = 'Marks tonight’s deaths or attacks, placed anew each time.';
const COUNTER = 'A counter the Storyteller advances.';

/** Characters whose tokens may all move, with why. */
export const MOVING_REMINDERS: Record<CharacterId, string> = {
	bountyhunter: 'A new evil player is shown when the last one dies.',
	balloonist: EACH_NIGHT,
	sailor: EACH_NIGHT,
	mathematician: 'Marks this night’s malfunctioning players.',
	undertaker: 'Marks whoever was executed today.',
	innkeeper: EACH_NIGHT,
	monk: EACH_NIGHT,
	gambler: DEATHS,
	acrobat: EACH_NIGHT,
	exorcist: EACH_NIGHT,
	gossip: DEATHS,
	cannibal: 'Follows the most recent execution.',
	amnesiac: 'The Storyteller decides what these mean.',
	minstrel: 'Marks a day-long effect.',
	tealady: 'Follows the Tea Lady’s alive neighbours.',
	hermit: 'Marks which Outsider abilities the Hermit has.',
	butler: EACH_NIGHT,
	goon: 'Follows whoever chose the Goon tonight.',
	lunatic: EACH_NIGHT,
	tinker: DEATHS,
	moonchild: DEATHS,
	barber: 'Marks tonight’s haircuts.',
	hatter: 'Marks tonight’s tea party.',
	godfather: DEATHS,
	poisoner: EACH_NIGHT,
	devilsadvocate: EACH_NIGHT,
	harpy: EACH_NIGHT,
	witch: EACH_NIGHT,
	cerenovus: EACH_NIGHT,
	fearmonger: 'The Fearmonger may choose a new player.',
	wizard: 'The Storyteller decides what these mean.',
	xaan: COUNTER,
	summoner: COUNTER,
	goblin: 'Placed on whoever claims the Goblin today.',
	organgrinder: EACH_NIGHT,
	yaggababble: DEATHS,
	pukka: EACH_NIGHT,
	lilmonsta: 'The babysitter can change each night.',
	nodashii: 'Follows the No Dashii’s nearest Townsfolk neighbours.',
	imp: DEATHS,
	shabaloth: DEATHS,
	ojo: DEATHS,
	kazali: DEATHS,
	po: DEATHS,
	zombuul: DEATHS,
	vortox: DEATHS,
	legion: DEATHS,
	lordoftyphon: DEATHS,
	alhadikhia: EACH_NIGHT,
	riot: COUNTER,
	thief: EACH_NIGHT,
	bureaucrat: EACH_NIGHT,
	barista: EACH_NIGHT,
	harlot: EACH_NIGHT,
	cacklejack: 'Placed on a new choice each day.',
	bishop: 'Placed on a new choice each day.',
	duchess: 'Placed on new visitors each day.',
	bootlegger: 'The Storyteller decides what these mean.',
	ventriloquist: 'Placed on a new choice each time.'
};

/**
 * Characters whose abilities can legitimately carry a fixed token to another player, by
 * changing or swapping who holds a character (a swapped Evil Twin takes "Twin" along).
 * While one is in play, the warning names it.
 */
export const REMINDER_RELOCATORS: Record<CharacterId, string> = {
	barber: 'swaps two players’ characters',
	pithag: 'changes a player’s character',
	snakecharmer: 'swaps characters with the Demon',
	farmer: 'makes a good player a Farmer',
	hatter: 'lets players change characters'
};
