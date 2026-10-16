/** The Settings dialog and its built-in sections. */
export const settings = {
	'settings.title': 'Settings',
	'settings.sections': 'Settings sections',
	'settings.allSettings': 'All settings',
	'settings.appliesTo': 'Applies to: {audience}',
	'settings.audienceEveryone': 'Storyteller and players',
	'settings.audienceStoryteller': 'Storyteller only',
	'settings.appearance': 'Appearance',
	'settings.fonts': 'Fonts',
	'settings.tokens': 'Tokens',
	'settings.icons': 'Icons',
	'settings.rulesTerms': 'Rules terms',
	'settings.storyteller': 'Storyteller settings',
	'settings.reset': 'Reset settings',
	'settings.data': 'Data',
	'settings.theme': 'Theme',
	'settings.textSize': 'Text size',
	'settings.textSizeHelp':
		'Changes the size of text only; buttons, icons and spacing stay the same.',
	'settings.textAlign': 'Text alignment',
	'settings.textAlignHelp':
		'How paragraphs line up: ability text, night steps, notes and help text. Justified spreads each line to both edges. Headings, labels and buttons stay as they are.',
	'settings.alignLeft': 'Left aligned',
	'settings.alignJustify': 'Justified',
	'settings.resetTo100': 'Reset to 100%',
	'settings.iconSize': 'Icon size',
	'settings.iconSizeHelp':
		'Changes the size of interface icons: header, settings, menus, buttons, status markers such as dead or poisoned, and character icons in badges. Text size and character token size stay the same.',
	'settings.tileSymbols': 'Symbols on bag tiles',
	'settings.tileSymbolsHelp':
		'Face-down tiles on the bag draw show a random symbol. Off shows numbers.',
	'settings.requireName': 'Require a name before drawing',
	'settings.requireNameHelp': 'A player types their name before they can see the token they drew.',
	'settings.fontPreview': 'Preview',
	'settings.iconStyle': 'Icon style',
	'settings.iconStyleHelp': 'Phosphor icons in six weights.',
	'settings.resetAll': 'Reset all settings',
	'settings.resetAllButton': 'Reset all',
	'settings.resetConfirmTitle': 'Reset settings?',
	'settings.resetConfirmText':
		'Theme, fonts, text size, text alignment, token sizes and colours, icon size, icons and Storyteller settings go back to their defaults.',
	'settings.resetConfirm': 'Reset',
	'settings.resetDone': 'Settings reset',
	'settings.resetDoneText': 'Back to the defaults on this device.',
	'settings.confirm': 'Confirm',
	'settings.storageUsed': 'Storage used on this device',
	'settings.storageTotal': 'Total',
	'settings.storageSaved': 'Games, notes and scripts',
	'settings.storageOffline': 'Offline copy and icons',
	'settings.storageUnknown': 'Not shown by this browser',
	'settings.clearCache': 'Clear cache',
	'settings.clearCacheHelp':
		'Stored character icons and wiki text. They download again when needed.',
	'settings.clearCacheTitle': 'Clear cache?',
	'settings.clearCacheConfirm':
		"Removes the character icons and wiki text stored on this device, then reloads the app. They download again when needed; the current script's icons download again straight away. Games, notes, scripts and settings stay.",
	'settings.clearGames': 'Clear saved games',
	'settings.clearGamesHelp': 'Every Storyteller game on this device, including one in progress.',
	'settings.clearGamesTitle': 'Clear saved games?',
	'settings.clearGamesConfirm':
		"Deletes every saved game on this device, including any game in progress and its history, then reloads the app. This can't be undone.",
	'settings.clearNotes': 'Clear player notes',
	'settings.clearNotesHelp': 'Everything written in Player view: notes, names and claims.',
	'settings.clearNotesTitle': 'Clear player notes?',
	'settings.clearNotesConfirm':
		"Deletes every Player view notebook on this device (notes, player names, claims and seat layout) for every script, then reloads the app. This can't be undone.",
	'settings.clearScripts': 'Clear recent scripts',
	'settings.clearScriptsHelp': 'Scripts loaded on this device. Scripts saved to your account stay.',
	'settings.clearScriptsTitle': 'Clear recent scripts?',
	'settings.clearScriptsConfirm':
		"Deletes the recently loaded scripts kept on this device, then reloads the app. Scripts saved to your account and shared codes stay. This can't be undone.",
	'settings.clearAll': 'Clear all data on this device',
	'settings.clearAllHelp':
		'Games, notes, scripts, settings, problem log and stored files. The app itself stays installed.',
	'settings.clearAllTitle': 'Clear all data on this device?',
	'settings.clearAllConfirm':
		"Deletes everything Grim-Games keeps on this device: saved games, player notes, recent scripts, settings, custom info tokens, the problem log, stored icons and wiki text. Signs you out if you are signed in, then reloads the app. The app itself stays installed so it still opens offline. This can't be undone."
} as const;
