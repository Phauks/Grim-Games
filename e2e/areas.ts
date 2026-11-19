/**
 * Every e2e file belongs to one area, and CI runs each area as its own check (.github/workflows/ci.yml),
 * so a red check names what broke. A new `*.e2e.ts` goes in the area of what it tests;
 * scripts/e2e-areas.test.ts fails while a file has no area or the CI matrix differs from `jobs`.
 * `jobs` splits a slow area over several CI jobs: keep each job under about 20 minutes
 * (Nov 19 2026: about 183 minutes of tests in all on a 2-worker runner).
 * `npm run test:e2e:area -- <id>` runs one area locally.
 */
export type E2eArea = {
	/** Used in CI and on the command line. */
	id: string;
	/** The check name in CI. */
	name: string;
	/** How many CI jobs share the area. */
	jobs: number;
	/** File names in e2e/. */
	files: string[];
};

export const E2E_AREAS: E2eArea[] = [
	// The Storyteller board: seats, tokens, reminders, the bank, info tokens, the game pane.
	{
		id: 'board',
		name: 'Grimoire board',
		jobs: 3,
		files: [
			'board-pane.e2e.ts',
			'board-pick.e2e.ts',
			'board-timer-look.e2e.ts',
			'corner-seams.e2e.ts',
			'count-off.e2e.ts',
			'custom-info-tokens.e2e.ts',
			'dead-reminder-ask.e2e.ts',
			'fixed-reminders.e2e.ts',
			'give-seat.e2e.ts',
			'grim-cover.e2e.ts',
			'grim-home.e2e.ts',
			'grim-shape.e2e.ts',
			'grimoire.e2e.ts',
			'hand-seat-marks.e2e.ts',
			'held-reminder-front.e2e.ts',
			'info-tokens-sheet.e2e.ts',
			'menu-spot.e2e.ts',
			'mouse.e2e.ts',
			'neighbour-reminders.e2e.ts',
			'new-token-drop.e2e.ts',
			'note-lists.e2e.ts',
			'number-token.e2e.ts',
			'reminder-tray-parity.e2e.ts',
			'scratch-pad.e2e.ts',
			'seat-sheet.e2e.ts',
			'seat-token-size.e2e.ts',
			'stacked-blocks.e2e.ts',
			'step-seat-badge.e2e.ts',
			'table-columns.e2e.ts',
			'table-resize.e2e.ts',
			'token-flow.e2e.ts',
			'token-flow-b.e2e.ts',
			'tray-caption-reopen.e2e.ts'
		]
	},
	// Character abilities and jinxes, night steps, game modes and setup.
	{
		id: 'rules',
		name: 'Characters, rules and setup',
		jobs: 2,
		files: [
			'acts-twice.e2e.ts',
			'bounty-hunter-setup.e2e.ts',
			'character-changes.e2e.ts',
			'character-picker.e2e.ts',
			'character-piece.e2e.ts',
			'fabled-abilities.e2e.ts',
			'fake-team.e2e.ts',
			'fang-gu-jump.e2e.ts',
			'game-modes.e2e.ts',
			'homebrew-icon-fallback.e2e.ts',
			'if-chosen.e2e.ts',
			'jinx-notes.e2e.ts',
			'jinxes.e2e.ts',
			'lord-of-typhon-setup.e2e.ts',
			'lunatic.e2e.ts',
			'madness.e2e.ts',
			'night-walk-own-wake.e2e.ts',
			'not-in-play.e2e.ts',
			'philosopher.e2e.ts',
			'poisoned-info.e2e.ts',
			'puzzlemaster-drunk.e2e.ts',
			'savant.e2e.ts',
			'script-rules.e2e.ts',
			'script-sheet-rules.e2e.ts',
			'setup.e2e.ts',
			'setup-note.e2e.ts',
			'wiki-gap-controls.e2e.ts',
			'zenomancer.e2e.ts'
		]
	},
	// Rooms, joining and playing on a phone, friends, accounts, sharing, sounds.
	{
		id: 'rooms',
		name: 'Rooms and players',
		jobs: 2,
		files: [
			'account.e2e.ts',
			'admin-accounts.e2e.ts',
			'ambience.e2e.ts',
			'badges.e2e.ts',
			'feedback-account.e2e.ts',
			'friends.e2e.ts',
			'invite-push.e2e.ts',
			'live-games.e2e.ts',
			'offline-share.e2e.ts',
			'play.e2e.ts',
			'player-messages.e2e.ts',
			'player-status.e2e.ts',
			'player-view-parity.e2e.ts',
			'players-feedback.e2e.ts',
			'public-town.e2e.ts',
			'role-privacy.e2e.ts',
			'room.e2e.ts',
			'room-names.e2e.ts',
			'room-remove.e2e.ts',
			'room-seating.e2e.ts',
			'room-transfer.e2e.ts',
			'share.e2e.ts',
			'show-grimoire.e2e.ts',
			'show-records.e2e.ts',
			'show-to-player.e2e.ts',
			'soundboard.e2e.ts',
			'spectator-messages.e2e.ts',
			'storyteller-sounds.e2e.ts',
			'test-room.e2e.ts'
		]
	},
	// The day, nominations and executions, starting and ending a game, late players.
	{
		id: 'day',
		name: 'Day and game flow',
		jobs: 1,
		files: [
			'back-to-town.e2e.ts',
			'back-to-town-push.e2e.ts',
			'claims.e2e.ts',
			'day.e2e.ts',
			'deal.e2e.ts',
			'end-screens.e2e.ts',
			'execution-pick.e2e.ts',
			'game-clock.e2e.ts',
			'game-info.e2e.ts',
			'game-opening.e2e.ts',
			'game-result.e2e.ts',
			'game-settings.e2e.ts',
			'grimoire-day.e2e.ts',
			'late-player.e2e.ts',
			'leave-game.e2e.ts',
			'new-game-from-info.e2e.ts',
			'new-game-menu.e2e.ts',
			'nominations.e2e.ts',
			'players-only.e2e.ts',
			'players-status.e2e.ts',
			'start-flow.e2e.ts',
			'timer-wake-lock.e2e.ts',
			'traveller-pick.e2e.ts'
		]
	},
	// App shell, settings and theme, ways back, layout checks, offline, errors, reports.
	{
		id: 'app',
		name: 'App, settings and theme',
		jobs: 1,
		files: [
			'animations.e2e.ts',
			'app.e2e.ts',
			'button-edges.e2e.ts',
			'caret-dividers.e2e.ts',
			'clearable-field.e2e.ts',
			'credits.e2e.ts',
			'csp.e2e.ts',
			'data-settings.e2e.ts',
			'desktop.e2e.ts',
			'dialog-scroll.e2e.ts',
			'errors.e2e.ts',
			'focus-ring.e2e.ts',
			'frames.e2e.ts',
			'home.e2e.ts',
			'install-app.e2e.ts',
			'language-setting.e2e.ts',
			'moving-backgrounds.e2e.ts',
			'navigation.e2e.ts',
			'no-sideways-scroll.e2e.ts',
			'none-state.e2e.ts',
			'nothing-covered.e2e.ts',
			'offline.e2e.ts',
			'overlay-stack.e2e.ts',
			'page-layout.e2e.ts',
			'pull-to-refresh.e2e.ts',
			'report-offline.e2e.ts',
			'reports.e2e.ts',
			'screen-theme.e2e.ts',
			'scrollbar-room.e2e.ts',
			'setting-previews.e2e.ts',
			'settings.e2e.ts',
			'settings-framework.e2e.ts',
			'settings-search.e2e.ts',
			'size-extremes.e2e.ts',
			'stale-build.e2e.ts',
			'support.e2e.ts',
			'token-settings.e2e.ts',
			'type-bands.e2e.ts',
			'update-prompt.e2e.ts',
			'way-back.e2e.ts'
		]
	},
	// Scripts, the library, the script, character and mode builders, printing, reference.
	{
		id: 'scripts',
		name: 'Scripts and builders',
		jobs: 1,
		files: [
			'character-builder.e2e.ts',
			'character-lab.e2e.ts',
			'glossary.e2e.ts',
			'library.e2e.ts',
			'library-sync.e2e.ts',
			'live-scan.e2e.ts',
			'mode-builder.e2e.ts',
			'photo-script.e2e.ts',
			'print-sheet.e2e.ts',
			'reference.e2e.ts',
			'script-builder.e2e.ts',
			'script-logo.e2e.ts',
			'script-rating.e2e.ts',
			'script-sheet.e2e.ts',
			'script-travellers.e2e.ts',
			'scripts.e2e.ts'
		]
	}
];
