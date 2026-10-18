import { APP_NAME } from '#lib/core/app-name.ts';

/** The player view (/play): script sheet, night order, circle and notes. */
export const player = {
	'player.title': 'Player view',
	'player.pageTitle': `Player view · ${APP_NAME}`,
	'player.loadFailed': 'Could not load the script: {error}',
	'player.loading': 'Loading…',
	'player.tab.script': 'Script',
	'player.tab.night': 'Night',
	'player.tab.notes': 'Notes',
	'player.sharedLinkFailed': 'Could not open the shared script',
	'player.cannotSave': 'This browser cannot save',
	'player.cannotSaveDetail': 'Notes are lost when the page closes.',

	'player.recommendedTravellers': 'Recommended Travellers',
	'player.jinxes': 'Jinxes',
	'player.chooseScript': 'Choose a script',
	'player.findScript': 'Find a script',
	'player.breakdown': 'Players',
	'player.playerCount': '{n} players',
	'player.characterType': 'Character type',

	'player.firstNight': 'First night',
	'player.otherNights': 'Other nights',

	'player.myNotes': 'My notes',
	'player.newNote': 'New note',
	'player.untitled': 'Untitled',
	'player.empty': 'Empty',
	'player.hidden': 'Hidden',
	'player.note': 'Note',
	'player.noteTitle': 'Title',
	'player.noteText': 'Text',
	'player.deleteNote': 'Delete note',
	'player.deleteNoteConfirm': 'Delete this note?',
	'player.deleteNoteBody': '“{title}” will be deleted from this device.',
	'player.keep': 'Keep',
	'player.delete': 'Delete',

	'player.density': 'Script sheet layout',
	'player.densityDetail':
		"How tightly the Script sheet is laid out for you, on screen and in print. Applies to the player view and the Storyteller's copy of the script.",
	'player.density.normal': 'Normal',
	'player.density.compact': 'Compact',
	'player.density.super': 'Super-compact',
	'player.byAuthor': 'by {author}',
	'player.version': 'v{version}',
	'player.print': 'Print script',
	'player.jinxedWith': 'Jinxed with {names}'
} as const;
