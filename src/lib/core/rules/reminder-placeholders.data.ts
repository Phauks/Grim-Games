/**
 * What each `:reminder:` in TPI's night text means (Trevor, 2026-10-15: ":reminder: ...
 * defers to the first reminder token, which is not always proper. see pukka").
 *
 * TPI's text marks where a reminder token is handled with a bare `:reminder:`; it never says
 * which token, or whether it goes on or comes off. This table says so for every occurrence,
 * keyed `<characterId>:<first|other>`, one entry per `:reminder:` in text order:
 * - `tokens`: the reminder tokens (TPI's names, from the character's own reminders);
 * - each token's `action`: `place` puts it on a player, `remove` takes it off;
 * - `either`: only one of the tokens applies, depending on what happens (the Barista's
 *   two effects, the Po's single kill or charge).
 *
 * Each mapping was decided from the character's wiki page (the rules authority); the page
 * is `https://wiki.bloodontheclocktower.com/<Name>`. A test checks every `:reminder:` in
 * the committed data has exactly one entry here and that every token is the character's.
 */
import type { CharacterId } from '#lib/core/data/types.ts';

export type PlaceholderAction = 'place' | 'remove';

export interface PlaceholderToken {
	label: string;
	action: PlaceholderAction;
}

export interface ReminderPlaceholder {
	tokens: readonly PlaceholderToken[];
	either?: boolean;
}

export type PlaceholderKey = `${CharacterId}:${'first' | 'other'}`;

const place = (...labels: string[]): ReminderPlaceholder => ({
	tokens: labels.map((label) => ({ label, action: 'place' }))
});
const either = (...labels: string[]): ReminderPlaceholder => ({ ...place(...labels), either: true });
const both = (
	...tokens: [string, PlaceholderAction][]
): ReminderPlaceholder => ({ tokens: tokens.map(([label, action]) => ({ label, action })) });
const dead = place('Dead');

export const REMINDER_PLACEHOLDERS: Readonly<Record<PlaceholderKey, readonly ReminderPlaceholder[]>> =
	{
		// Townsfolk
		// The Grandmother dies with her grandchild.
		'grandmother:other': [dead],
		// Drunk goes on the Sailor or the chosen player, whichever is drunk.
		'sailor:first': [place('Drunk')],
		'sailor:other': [place('Drunk')],
		// Marks the player shown, so the next one has a different character type.
		'balloonist:first': [place('Know')],
		'balloonist:other': [place('Know')],
		// A chosen Minion loses their ability.
		'preacher:first': [place('No Ability')],
		'preacher:other': [place('No Ability')],
		// With more than one Village Idiot, one is drunk.
		'villageidiot:first': [place('Drunk')],
		// The old Demon, now the Snake Charmer, is poisoned.
		'snakecharmer:first': [place('Poisoned')],
		'snakecharmer:other': [place('Poisoned')],
		// Two players are safe from death; one of them is drunk.
		'innkeeper:other': [place('Safe'), place('Safe'), place('Drunk')],
		'monk:other': [place('Safe')],
		// A wrong guess kills the Gambler.
		'gambler:other': [dead],
		// Marks the chosen player; the Acrobat's death is only if they are drunk or poisoned.
		'acrobat:other': [place('Chosen')],
		// Marks the chosen player, who can't be chosen again the next night.
		'exorcist:other': [place('Chosen')],
		// A good chosen player who is not the Faux Paw dies.
		'lycanthrope:other': [dead],
		'gossip:other': [dead],
		// Once used, the ability is gone.
		'engineer:first': [place('No Ability')],
		'engineer:other': [place('No Ability')],
		'nightwatchman:first': [place('No Ability')],
		'nightwatchman:other': [place('No Ability')],
		// The chosen character's player is drunk for 3 nights and 3 days; the ability is used.
		'courtier:first': [place('Drunk 3'), place('No Ability')],
		'courtier:other': [place('Drunk 3'), place('No Ability')],
		'seamstress:first': [place('No Ability')],
		'seamstress:other': [place('No Ability')],
		// An in-play character's player is drunk; otherwise the Philosopher becomes it.
		'philosopher:first': [either('Drunk', 'Is The Philosopher')],
		'philosopher:other': [either('Drunk', 'Is The Philosopher')],
		'huntsman:first': [place('No Ability')],
		'huntsman:other': [place('No Ability')],
		// A resurrected Townsfolk; the ability is used either way.
		'professor:other': [place('Alive'), place('No Ability')],
		// The Demon kills no one tonight.
		'princess:other': [place("Doesn't Kill")],
		// The Banshee, killed by the Demon, gains their nominate-and-vote ability.
		'banshee:other': [place('Has Ability')],

		// Outsiders
		'butler:first': [place('Master')],
		'butler:other': [place('Master')],
		'ogre:first': [place('Friend')],
		'tinker:other': [dead],
		// The Sweetheart's death makes one player drunk for the rest of the game.
		'sweetheart:other': [place('Drunk')],
		'plaguedoctor:other': [place('Storyteller Ability')],
		'moonchild:other': [dead],

		// Minions
		// The player who said the word turns evil; the Mezepheles' ability is used.
		'mezepheles:other': [both(['Turns Evil', 'remove']), place('No Ability')],
		'godfather:other': [dead],
		'poisoner:first': [place('Poisoned')],
		'poisoner:other': [place('Poisoned')],
		'devilsadvocate:first': [place('Survives Execution')],
		'devilsadvocate:other': [place('Survives Execution')],
		// The 1st target is mad; the 2nd is the player they must be mad about.
		'harpy:first': [place('Mad'), place('2nd')],
		'harpy:other': [place('Mad'), place('2nd')],
		'witch:first': [place('Cursed')],
		'witch:other': [place('Cursed')],
		'cerenovus:first': [place('Mad')],
		'cerenovus:other': [place('Mad')],
		'fearmonger:first': [place('Fear')],
		'fearmonger:other': [place('Fear')],
		// Kills through protection; once per game.
		'assassin:other': [dead, place('No Ability')],
		// The Widow poisons a player; one good player learns a Widow is in play.
		'widow:first': [place('Poisoned'), place('Know')],
		// The night counter, then X on the Xaan on night X.
		'xaan:first': [place('Night 1'), place('X')],
		'xaan:other': [either('Night 2', 'Night 3'), place('X')],
		'summoner:other': [either('Night 2', 'Night 3')],
		// Drunk while the Organ Grinder chooses to be.
		'organgrinder:first': [place('Drunk')],
		'organgrinder:other': [place('Drunk')],

		// Demons
		'yaggababble:other': [dead],
		// Tonight's target is poisoned; last night's target dies and becomes healthy.
		'pukka:first': [place('Poisoned')],
		'pukka:other': [place('Poisoned'), both(['Dead', 'place'], ['Poisoned', 'remove'])],
		// The Minions choose who babysits Lil' Monsta; the Demon kills.
		'lilmonsta:first': [place('Is The Demon')],
		'lilmonsta:other': [place('Is The Demon'), dead],
		'nodashii:other': [dead],
		'imp:other': [dead],
		// A player killed last night may come back; then 2 kills.
		'shabaloth:other': [place('Alive'), dead, dead],
		'ojo:other': [dead],
		'kazali:other': [dead],
		// One kill, or no kill and 3 Attacks; after a charge, 3 kills.
		'po:other': [either('Dead', '3 Attacks'), dead, dead, dead],
		'zombuul:other': [dead],
		// A kill; a killed Minion keeps their ability and poisons a neighbouring Townsfolk.
		'vigormortis:other': [dead, place('Has Ability'), place('Poisoned')],
		'vortox:other': [dead],
		'legion:other': [dead],
		// A kill; the Fang Gu's jump happens once only.
		'fanggu:other': [dead, place('Once')],
		'lordoftyphon:other': [dead],
		// The host is poisoned; then the Lleech kills each night.
		'lleech:first': [place('Poisoned')],
		'lleech:other': [dead],
		'alhadikhia:other': [place('1'), place('2'), place('3')],
		'riot:other': [either('Day 1', 'Day 2', 'Day 3')],
		'leviathan:first': [place('Day 1')],
		'leviathan:other': [either('Day 2', 'Day 3', 'Day 4', 'Day 5')],

		// Travellers
		'thief:first': [place('Negative Vote')],
		'thief:other': [place('Negative Vote')],
		'bureaucrat:first': [place('3 Votes')],
		'bureaucrat:other': [place('3 Votes')],
		'barista:first': [either('Sober & Healthy', 'Acts Twice')],
		'barista:other': [either('Sober & Healthy', 'Acts Twice')],
		'harlot:other': [dead, dead],
		// The chosen dead player has their ability until dusk; the Bone Collector's is used.
		'bonecollector:other': [place('Has Ability', 'No Ability')],
		'apprentice:first': [place('Is The Apprentice')],

		// Fabled
		'angel:first': [place('Protected')]
	};
