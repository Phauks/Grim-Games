/** Character selection, the bag draw and the setup steps (features/setup, /setup, /draw). */
export const setup = {
	'setup.pageTitle.characters': 'Characters · Grim-Games',
	'setup.pageTitle.draw': 'Draw · Grim-Games',
	'setup.grimoire': 'Grimoire',
	'setup.steps': 'Setup steps',
	'setup.nav': 'Setup',
	'setup.step.characters': 'Characters',
	'setup.step.draw': 'Draw',
	'setup.couldNot': "Couldn't do that",

	'setup.characters': 'Characters',
	'setup.script': 'Script',
	'setup.players': 'Players',
	'setup.fewerPlayers': 'Fewer players',
	'setup.morePlayers': 'More players',
	'setup.sheet': 'Setup sheet',
	'setup.random': 'Random selection',
	'setup.clearSelection': 'Clear selection',
	'setup.buildBag': 'Build bag',
	'setup.or': 'or',
	'setup.jinxed': 'Jinxed',
	'setup.addAnother': 'Add another',
	'setup.addAnotherOf': 'Add another {name}',

	'setup.clear.title': 'Clear the selection?',
	'setup.clear.body': {
		one: 'Now: {count} character chosen. After: none.',
		other: 'Now: {count} characters chosen. After: none.'
	},
	'setup.clear.keep': 'Keep',
	'setup.clear.confirm': 'Clear',
	'setup.errors.title': 'Build with errors?',
	'setup.errors.description': "This bag doesn't match the setup for {players} players.",
	'setup.errors.back': 'Go back',
	'setup.errors.anyway': 'Build anyway',
	'setup.errors.travellers': {
		one: '{count} Traveller chosen; expected {expected} for {players} players.',
		other: '{count} Travellers chosen; expected {expected} for {players} players.'
	},
	'setup.replace.title': 'Replace the bag?',
	'setup.leave.title': 'Leave the draw?',
	'setup.leave.body': {
		one: 'Now: {count} of {total} tiles not yet drawn. The bag is kept, so you can come back to the draw.',
		other:
			'Now: {count} of {total} tiles not yet drawn. The bag is kept, so you can come back to the draw.'
	},
	'setup.replace.body': {
		one: 'Now: {count} of {total} tiles drawn. After: a new bag of {tiles} tiles and the draw starts again. The character already on a seat stays; History can restore the old bag.',
		other:
			'Now: {count} of {total} tiles drawn. After: a new bag of {tiles} tiles and the draw starts again. The characters already on seats stay; History can restore the old bag.'
	},
	'setup.replace.keep': 'Keep',
	'setup.replace.confirm': 'Replace',

	'setup.standIn.title': 'What is the {name} shown?',
	'setup.standIn.description': 'Choose the token that goes in the bag for the {name}.',
	'setup.check': 'Setup check',
	'setup.check.warnings': 'Warnings',
	'setup.check.shownInstead': 'Shown instead',
	'setup.check.isShown': 'is shown',
	'setup.check.shownTo': 'Shown to the {name}',
	'setup.check.setupChanges': 'Setup changes',
	'setup.check.jinxes': 'Jinxes',
	'setup.check.and': 'and',
	'setup.check.choose': 'Choose',
	'setup.check.notOnScript':
		'{name} needs the {required} in play, but the {required} is not on the script.',

	'setup.draw': 'Draw',
	'setup.draw.noBag': 'No bag. Select characters and build the bag first.',
	'setup.draw.next': 'Next',
	'setup.draw.bag': 'Bag',
	'setup.draw.held': 'Held',
	'setup.draw.tile': 'Tile {number}',
	'setup.draw.tileHeld': 'Tile {number}, held by {seat}',
	'setup.draw.tileDrawn': 'Tile {number}, drawn',
	'setup.draw.everySeat': 'Every seat has a character',
	'setup.draw.everySeatHint': 'Add a seat on the grimoire to draw for it.',

	'setup.reveal.name': 'Name',
	'setup.reveal.locked': 'Enter your name to see your character',
	'setup.reveal.alignment': 'Alignment',
	'setup.reveal.good': 'Good',
	'setup.reveal.evil': 'Evil',
	'setup.reveal.confirm': 'Confirm',
	'setup.reveal.reveal': 'Reveal',

	'setup.open.loading': 'Opening the game…',
	'setup.open.missing': 'There is no saved game here on this device.',
	'setup.open.tooNew':
		'This game was saved by a newer version of Grim-Games. Refresh to update, then open it again.',
	'setup.open.savedGames': 'Saved games'
} as const;
