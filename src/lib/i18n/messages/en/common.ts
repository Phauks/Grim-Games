import { APP_NAME } from '#lib/core/app-name.ts';

/** Words every feature shares. */
export const common = {
	'common.cancel': 'Cancel',
	'common.clear': 'Clear',
	'common.close': 'Close',
	'common.moreTabs': 'More tabs',
	'common.searchShortcut': 'Search (press /)',
	'common.searchReminders': 'Search reminders',
	'common.confirm': 'Confirm',
	'common.none': 'None',
	'common.putDown': 'Put down',
	'common.aboutReminder': 'About this reminder',
	'common.moreReminderActions': 'More reminder actions',
	'common.hideContents': 'Hide contents',
	'common.showPassword': 'Show password',
	'common.seat': 'Seat {number}',
	'common.seatWithName': '{seat} ({name})',
	'common.notInPlay': 'Not in play',
	'common.inPlay': 'In play',
	'common.save': 'Save',
	'common.saved': 'Saved',
	'common.saveNew': 'Save as new',
	'common.copyJson': 'Copy JSON',
	'common.gameOpening': 'Opening the game…',
	'common.gameMissing': 'There is no saved game here on this device.',
	'common.gameTooNew': `This game was saved by a newer version of ${APP_NAME}. Refresh to update, then open it again.`,
	'common.players': { one: '{count} player', other: '{count} players' }
} as const;
