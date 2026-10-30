/** Show to player: the full-screen player view and its character chooser. */
export const show = {
	'show.chosen': 'Chosen',
	'show.remove': 'Remove {name}',
	'show.removeInPlay': 'Remove {name}, in play',
	'show.inPlay': 'In play',
	'show.notInPlayOnly': 'Not in play only',
	'show.goodOnly': 'Good only',
	'show.evilOnly': 'Evil only',
	'show.random': 'Random',
	'show.shownToPlayer': 'Shown to player',
	'show.card': 'Card {number} of {count}',
	'show.cards': 'Cards',
	'show.previousCard': 'Previous card',
	'show.nextCard': 'Next card',
	'show.failed': "Couldn't show this.",
	'show.cover': 'Cover the screen',
	'show.covered': 'Screen covered',
	'show.byAuthor': 'by {author}',
	'show.playerView': 'Player view',
	'show.evil.title': 'Cards to show',
	'show.evil.show': 'Show',
	'show.evil.showNamed': 'Show {card}',
	'show.evil.chooseBluffs': 'Choose bluffs',
	'show.evil.inPlay': 'In play: replace',
	// A player who believes they are the Demon (the Lunatic), from the mockup Trevor approved
	// (2026-10-29).
	'show.evil.believerTitle': 'Sell the Demon',
	'show.evil.as': 'As the',
	'show.evil.choose': 'Choose',
	'show.evil.edit': 'Edit',
	'show.evil.chose': 'chose',
	'show.evil.decoyChose': 'The decoy chose',
	'show.evil.add': 'Add {name}',
	'show.evil.hidden': 'in play: the Demon and Minions don’t learn each other',
	// Fair-play warnings (FairPlayNotice), in Trevor's own words (2026-10-27).
	'show.fairPlay.secret':
		'This is for your eyes only. Please do not screenshot, photograph, or otherwise share this screen in any way that could compromise the integrity of this game.',
	'show.fairPlay.short': 'This is for your eyes only.',
	'show.fairPlay.title': 'Do Not Share With Players',
	'show.fairPlay.message':
		'Only send what the Storyteller needs to know. Never use this to get around the rules or pass on secret information.',
	// The look on a player's seat (Trevor, 2026-10-29: a warning, not a lock during the game).
	'show.fairPlay.profile':
		'Everyone at the table sees this on your seat. Never change it during a game to hint at a character, or in any way that could compromise the integrity of this game.',
	'show.fairPlay.watchLead':
		'You will see everything the Storyteller sees: every character, reminder and note. You promise that:',
	'show.fairPlay.watchCheat': 'You won’t use it to cheat, or to help anyone playing.',
	'show.fairPlay.watchShare': 'You won’t tell or show any player what you see.',
	'show.fairPlay.watchIntegrity': 'You won’t do anything that spoils the game for its players.'
} as const;
