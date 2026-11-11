/**
 * How to write a game mode or special rule file, part by part: the guide on New game's Add
 * mode dialog and the Mode builder (format-guide.ts). One format for both since 2026-11-01
 * (Trevor: "One format, auto-labelled").
 */
import { FILE_SECTIONS, GAME_MODE_FORMAT, MODE_SECTIONS, WHOLE_GAME_SECTIONS } from './types.ts';
import { guideSection } from './setup-guide.ts';
import { GAME_MODE_REVISION, type GuideField, type GuideSection } from './guide-fields.ts';

export const GUIDE_INTRO = [
	'A game mode and a special rule are written the same way: one JSON object. Paste it, or open a .json file, in Add mode, or make one in the Mode builder. Every problem is listed with where it is (for example setup.assignment.offers), so a file can be fixed in one go.',
	`The app labels each file from its setup. A file that sets ${WHOLE_GAME_SECTIONS.join(', ')}, or a pool other than script or script-plus-hidden, sets up the whole game, so it is a game mode: a game has one, picked on New game. Any other file only adds to a game, so it is a special rule: a game can have any number.`,
	'When the mode and its rules, or two rules, set the same one-answer section differently, New game warns and the Storyteller decides. Lists are joined and count changes add up.',
	'Start from a built-in mode or rule: Inspect shows its whole file.',
	'Character ids are the official ones, lower case with no spaces or dashes (pithag, bountyhunter). Unknown ids are refused.',
	'Every setup section is optional. A section left out is played as standard, and the app runs it. A section the app can’t run yet is shown in Inspect as run by the Storyteller.',
	'Links must start with https://. A mode names its sources, if a page describes it, and an author only with a link to a page that names them.'
];

/** The fields of the mode object itself. */
export const GUIDE_TOP: GuideField[] = [
	{
		name: 'format',
		type: 'number',
		required: true,
		about: `Always ${GAME_MODE_FORMAT}. It changes only when old files can no longer be read as they are.`
	},
	{
		name: 'revision',
		type: 'whole number',
		required: false,
		about: `The revision of this guide the file was written for (now ${GAME_MODE_REVISION}). Read either way; it helps say why an older file fails.`
	},
	{
		name: 'id',
		type: 'text',
		required: true,
		about:
			'Lower-case letters, digits and dashes (my-mode). It must not be a built-in mode’s id. Adding a file with the id of one of yours replaces it.'
	},
	{ name: 'name', type: 'text', required: true, about: 'The name the mode is known by.' },
	{
		name: 'aliases',
		type: 'list of text',
		required: false,
		about: 'Other names it goes by. Shown in Inspect.'
	},
	{
		name: 'about',
		type: 'text',
		required: false,
		about:
			'A short description of how it plays, shown under the mode when Show our own wording is on.'
	},
	{
		name: 'sources',
		type: 'list of links',
		required: true,
		about:
			'Where the rules come from, the rules page first: each { "title": "…", "url": "https://…" }. May be [] for a mode of your own that no page describes.'
	},
	{
		name: 'authors',
		type: 'list of links',
		required: false,
		about:
			'Who made the mode: each { "title": name, "url": a page that names them as its author }. Leave it out when no page says who made it. People only thanked are not authors.'
	},
	{
		name: 'unconfirmed',
		type: 'list of setup section names',
		required: false,
		about: 'Setup sections no source confirms. Inspect marks them.',
		values: FILE_SECTIONS
	},
	{
		name: 'conflictsWith',
		type: 'object',
		required: false,
		about:
			'{ "modes": [ids], "rules": [ids] }: modes and rules this one can’t sensibly be played with. Choosing both warns on New game.'
	},
	{
		name: 'setup',
		type: 'object',
		required: true,
		about:
			'What the file changes in the game’s setup, by section (below). Every section is optional.'
	},
	{
		name: 'rules',
		type: 'rules block',
		required: false,
		about:
			'What the file does in play, written as a character’s rules block: the same parts, read the same way, so a mode or rule works like a Fabled or Loric. Count changes are setupModifier, whom the Demon attacks is demonAttack with a target, who keeps an ability when dead is deadKeepAbilities, extra night wakes are nightWakes, and what a nomination sets off is onNominated.'
	}
];

/** Every game mode section, in Inspect's order, from its spec (`setup-guide.ts`). */
export const GUIDE_SECTIONS: GuideSection[] = MODE_SECTIONS.map(guideSection);

/** A file that is a standard game with one character banned: the least a mode needs. */
export const MINIMAL_EXAMPLE = {
	format: GAME_MODE_FORMAT,
	revision: GAME_MODE_REVISION,
	id: 'no-pit-hag',
	name: 'No Pit-Hag',
	sources: [{ title: 'Our group’s house rules', url: 'https://example.com/house-rules' }],
	setup: { restricted: { banned: ['pithag'] } }
};
