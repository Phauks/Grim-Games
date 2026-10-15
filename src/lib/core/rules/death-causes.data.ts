/**
 * Which official characters' abilities can cause a player to die, and how. Read by
 * `deathCauses` (death-causes.ts) so the death picker offers only characters that could
 * have caused the death.
 *
 * Kinds (`DEATH_KINDS`):
 * - `kills`: can kill a player, possibly including itself (Slayer, Witch, every Demon that
 *   kills, a Storyteller punishment such as the Angel's);
 * - `own-death`: can only cause its own player's death (Tinker, Gambler, Grandmother);
 * - `execution`: causes an execution or an extra one (Virgin, Butcher, Judge), or lets
 *   the Storyteller execute a player (Mutant, Cerenovus);
 * - `gained-ability`: causes a death only through another character's ability it has or
 *   gives (Philosopher, Pixie, Hermit, Plague Doctor).
 *
 * `onlyWith`: the entry applies only when one of these characters is also on the script or
 * in play (a jinx gives the ability its death).
 *
 * Every entry cites the character's wiki page (the rules authority); the kinds are our
 * reading of TPI's ability text and that page. Characters whose ability never causes a
 * death are in `NO_DEATH`, with a short reason in our own words. A test checks every
 * official character is in exactly one of the two.
 */
import type { CharacterId } from '#lib/core/data/types.ts';

export const DEATH_KINDS = ['kills', 'own-death', 'execution', 'gained-ability'] as const;
export type DeathKind = (typeof DEATH_KINDS)[number];

export interface DeathCauseEntry {
	kind: DeathKind;
	/** The character's wiki page. */
	wiki: string;
	/** Only when one of these is also on the script or in play (a jinx). */
	onlyWith?: readonly CharacterId[];
}

const W = 'https://wiki.bloodontheclocktower.com/';
const kills = (page: string): DeathCauseEntry => ({ kind: 'kills', wiki: W + page });
const ownDeath = (page: string): DeathCauseEntry => ({ kind: 'own-death', wiki: W + page });
const execution = (page: string): DeathCauseEntry => ({ kind: 'execution', wiki: W + page });
const gained = (page: string): DeathCauseEntry => ({ kind: 'gained-ability', wiki: W + page });

export const DEATH_CAUSE_ENTRIES: Readonly<Record<CharacterId, DeathCauseEntry>> = {
	// Townsfolk
	grandmother: ownDeath('Grandmother'),
	gambler: ownDeath('Gambler'),
	acrobat: ownDeath('Acrobat'),
	lycanthrope: kills('Lycanthrope'),
	gossip: kills('Gossip'),
	slayer: kills('Slayer'),
	// The Storyteller chooses the ability; it may cause deaths.
	amnesiac: kills('Amnesiac'),
	virgin: execution('Virgin'),
	pixie: gained('Pixie'),
	philosopher: gained('Philosopher'),
	alchemist: gained('Alchemist'),
	cannibal: gained('Cannibal'),

	// Outsiders
	tinker: ownDeath('Tinker'),
	golem: kills('Golem'),
	moonchild: kills('Moonchild'),
	mutant: execution('Mutant'),
	hermit: gained('Hermit'),
	plaguedoctor: gained('Plague_Doctor'),

	// Minions
	godfather: kills('Godfather'),
	harpy: kills('Harpy'),
	witch: kills('Witch'),
	pithag: kills('Pit-Hag'),
	psychopath: kills('Psychopath'),
	assassin: kills('Assassin'),
	wizard: kills('Wizard'),
	boomdandy: kills('Boomdandy'),
	cerenovus: execution('Cerenovus'),
	vizier: execution('Vizier'),
	boffin: gained('Boffin'),

	// Demons
	yaggababble: kills('Yaggababble'),
	pukka: kills('Pukka'),
	lilmonsta: kills("Lil'_Monsta"),
	nodashii: kills('No_Dashii'),
	imp: kills('Imp'),
	shabaloth: kills('Shabaloth'),
	ojo: kills('Ojo'),
	kazali: kills('Kazali'),
	po: kills('Po'),
	zombuul: kills('Zombuul'),
	vigormortis: kills('Vigormortis'),
	vortox: kills('Vortox'),
	legion: kills('Legion'),
	fanggu: kills('Fang_Gu'),
	lordoftyphon: kills('Lord_of_Typhon'),
	lleech: kills('Lleech'),
	alhadikhia: kills('Al-Hadikhia'),
	riot: kills('Riot'),
	// The Leviathan does not kill; the Banshee jinx has it choose a player who dies if Banshee.
	leviathan: { ...kills('Leviathan'), onlyWith: ['banshee'] },

	// Travellers
	harlot: kills('Harlot'),
	gunslinger: kills('Gunslinger'),
	gangster: kills('Gangster'),
	gnome: kills('Gnome'),
	butcher: execution('Butcher'),
	judge: execution('Judge'),
	scapegoat: execution('Scapegoat'),
	apprentice: gained('Apprentice'),

	// Fabled
	angel: kills('Angel'),
	hellslibrarian: kills("Hell's_Librarian"),
	doomsayer: kills('Doomsayer'),

	// Loric
	bigwig: kills('Big_Wig')
};

/** Official characters whose ability never causes a death, with the reason in short. */
export const NO_DEATH: Readonly<Record<CharacterId, string>> = {
	// Townsfolk
	steward: 'info',
	knight: 'info',
	chef: 'info',
	noble: 'info',
	investigator: 'info',
	washerwoman: 'info',
	clockmaker: 'info',
	librarian: 'info',
	shugenja: 'info',
	bountyhunter: 'info',
	empath: 'info',
	highpriestess: 'info',
	sailor: 'drunkenness; protects itself',
	balloonist: 'info',
	general: 'info',
	preacher: 'removes Minion abilities',
	chambermaid: 'info',
	villageidiot: 'info',
	snakecharmer: 'swaps characters',
	mathematician: 'info',
	king: 'info',
	dreamer: 'info',
	fortuneteller: 'info',
	cultleader: 'changes alignment; win condition',
	flowergirl: 'info',
	towncrier: 'info',
	oracle: 'info',
	undertaker: 'info',
	innkeeper: 'protects; drunkenness',
	monk: 'protects',
	exorcist: 'stops the Demon waking',
	savant: 'info',
	alsaahir: 'win condition',
	engineer: 'changes which Minions or Demon are in play',
	nightwatchman: 'info',
	courtier: 'drunkenness',
	seamstress: 'info',
	huntsman: 'changes the Damsel',
	professor: 'resurrects',
	artist: 'info',
	fisherman: 'info',
	princess: 'stops the Demon killing',
	juggler: 'info',
	soldier: 'protects itself',
	farmer: 'makes a Farmer when it dies',
	minstrel: 'drunkenness',
	ravenkeeper: 'info when it dies',
	sage: 'info when it dies',
	choirboy: 'info',
	banshee: 'extra nominations and votes',
	tealady: 'protects',
	mayor: 'win condition; the Demon kills whoever dies instead',
	fool: 'survives a death',
	magician: 'changes what evil learns',
	poppygrower: 'changes what evil learns',
	pacifist: 'executed players might survive',
	atheist: 'win condition',

	// Outsiders
	butler: 'vote restriction',
	goon: 'drunkenness; changes alignment',
	ogre: 'changes alignment',
	lunatic: 'thinks it is the Demon',
	drunk: 'is drunk',
	recluse: 'registration',
	sweetheart: 'drunkenness',
	klutz: 'loss condition',
	saint: 'loss condition',
	barber: 'swaps characters',
	hatter: 'changes Minion and Demon characters',
	politician: 'changes alignment',
	zealot: 'vote restriction',
	damsel: 'loss condition',
	snitch: 'bluffs',
	heretic: 'win condition',
	puzzlemaster: 'drunkenness; info',

	// Minions
	mezepheles: 'changes alignment',
	poisoner: 'poisons',
	devilsadvocate: 'executed player survives',
	spy: 'info; registration',
	fearmonger: 'loss condition',
	widow: 'poisons; info',
	xaan: 'poisons',
	marionette: 'thinks it is good',
	wraith: 'wakes with evil',
	summoner: 'makes a Demon; the Demon kills',
	eviltwin: 'win condition',
	goblin: 'win condition',
	mastermind: 'one more day; executions are normal',
	scarletwoman: 'becomes the Demon',
	organgrinder: 'secret votes; drunkenness',
	baron: 'setup',

	// Travellers
	thief: 'vote change',
	bureaucrat: 'vote change',
	barista: 'sobers or doubles another ability',
	cacklejack: 'changes a character',
	matron: 'swaps seats',
	bonecollector: 'returns an ability to a dead player',
	beggar: 'vote tokens; info',
	deviant: 'survives exile',
	bishop: 'nominations',
	voudon: 'votes',

	// Fabled
	buddhist: 'talking rule',
	deusexfiasco: 'Storyteller mistake',
	djinn: 'jinx rules',
	duchess: 'info',
	ferryman: 'vote tokens',
	fibbin: 'false info',
	fiddler: 'win condition',
	revolutionary: 'registration',
	sentinel: 'setup',
	spiritofivory: 'setup',
	toymaker: 'the Demon may not attack',

	// Loric
	bootlegger: 'homebrew rules',
	gardener: 'setup',
	godofug: 'speaking and voting rule',
	hindu: 'reincarnation',
	knaves: 'Storytellers',
	pope: 'setup',
	stormcatcher: 'protects; info',
	tor: 'hidden characters',
	ventriloquist: 'executed players might survive',
	zenomancer: 'info'
};
