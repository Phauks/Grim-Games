# Shared components

Trevor's rule: the same feature in two places is one shared component. Before building a
control, layout or helper, look here first. If what you need is close but not quite, extend
the shared one (a prop, a snippet) instead of copying it.

Each entry is one list line, never a table row: Prettier pads every row of a table to the
longest cell, so two PRs that each added a row used to conflict over the whole table.

## Where things live

- `src/lib/core`: Pure TypeScript rules and data, with Vitest tests. No Svelte or DOM.
- `src/lib/ui/primitives`: Controls with no game knowledge. Features never import `@ark-ui/*`.
- `src/lib/ui/layout`: Page structure: `Page`, `PageSection`.
- `src/lib/ui/builder`: The parts every builder page shares (Script builder, Character builder).
- `src/lib/ui/share`: The share screen (code, QR, link).
- `src/lib/ui/*.ts`: Helpers with no game knowledge: `stored.ts`, `download.ts`, `clipboard.ts`.
- `src/lib/features/characters`: Anything that draws a character or reminder.

## The shared pieces

- A page reached from the sidebar: `ui/layout/Page.svelte` (title, actions, subtitle, toolbar, side; puts the hamburger before the title while no sidebar shows) (enforced by review)
- A title whose words must not break in the middle: `fitWords` from `ui/fit-words.ts` (shrinks the text until its longest word fits; Page's title uses it) (enforced by `e2e/play.e2e.ts`)
- A board drawn inside a dialog that must fit the room left under what sits above it: `fitInDialog` from `ui/fit-in-dialog.ts` (sets `--fit-height` in a wide box; the player grim uses it in the Storyteller's player view) (enforced by `e2e/player-view-parity.e2e.ts`)
- The menu (You, App, build line, CCC logo): `features/shell/NavList.svelte`, in the sidebar (`AppNav`) and the drawer (`NavDrawer`) alike; there is no app header or footer (enforced by `e2e/navigation.e2e.ts`)
- A bottom sheet (a centred panel on a computer): `ui/primitives/BottomSheet.svelte`; `wide` for two columns, laid out by the sheet's own width (enforced by review)
- A short menu of actions behind ⋯: `ui/primitives/Menu.svelte` (icon trigger, one row per action, disabled rows kept in place; Join game's ⋯) (enforced by `e2e/public-town.e2e.ts`)
- The rooms this device joined as a player: `features/room/YourGames.svelte` (Join or resume's As player, above the saved games of `features/grimoire/SavedGamesSection.svelte`) (enforced by review)
- The build line (version, commit, other build): `features/about/BuildLine.svelte`, at the end of the menu above the CCC logo (enforced by `e2e/app.e2e.ts`)
- ☰ and the grim cover at a game screen's top left: `features/shell/GameLead.svelte` (`--menu-gap` between them), in the board's toolbar and the day sheet, which is Dialog's `screen` size so its header has the toolbar's spot (enforced by `e2e/menu-spot.e2e.ts`)
- Where a sticky piece stops at the top: the `--app-top` token (the status bar's inset) (enforced by review)
- A section of a page: `ui/layout/PageSection.svelte` (enforced by review)
- A section that opens and closes from its header, and anything else with a caret: `ui/primitives/Collapsible.svelte`: `storageKey` remembers it; `count` shows how many items it holds while closed (Trevor, 2026-10-19); `disabled` keeps it in place until it can open. It draws a line above itself when something sits above it in the same box (Trevor, 2026-10-27), so every caret has one indent, spacing, badge and line; a drop-down's caret (`aria-haspopup`) is a menu, not this (enforced by `grim/caret-section`, `e2e/caret-dividers.e2e.ts`)
- Sections one under another, wrapped (a night, a sheet's type): `ui/layout/SectionStack.svelte` draws the line between each two; `edge` adds one above the first, under a heading or a field (the player's Script, Night and Notes tabs, the Library sidebar, Info tokens, the changelog) (enforced by `e2e/caret-dividers.e2e.ts`)
- An element appearing or leaving (fade and short move): `rise` from `ui/motion.ts` (token speeds, none under reduced motion; transform and opacity only) (enforced by `no-restricted-imports`)
- A labelled text field, one line or several: `ui/primitives/TextField.svelte` (enforced by `grim/text-field`)
- A search box: `ui/primitives/SearchField.svelte` (enforced by `grim/text-field`)
- A list of short texts with add and remove: `ui/primitives/TextListField.svelte` (enforced by review)
- The clear X on a field: `ui/primitives/ClearableField.svelte` (TextField has it) (enforced by `grim/clearable-field`)
- A short code typed one character to a box (room code): `ui/primitives/CodeField.svelte` (enforced by review)
- A secret shown only while held (a character on the draw or on a phone): `ui/primitives/HoldToSee.svelte` (RevealDialog's hold to see, the player's Your character); `noLongPress` from `ui/no-long-press.ts` stops the phone's long-press buzz around it (enforced by review)
- One choice among a few: `ui/primitives/Select.svelte` (enforced by `grim/dropdown-choice`)
- One choice among many, found by typing: `ui/primitives/Combobox.svelte` (shares Select's list styles) (enforced by review)
- A setting kept per game (track nominations, the day timer on players' phones, seconds per living player, the bag draw's switches): read and change it through `gameSettings` in `features/game-settings/game-settings.svelte.ts`, never `preferences`; Settings' rows call `setDefault`, a place of use calls `set`. The rows are `features/game-settings/GameSettingsRows.svelte` (the start flow's Game settings and Board ⋯ › Game) and `BagDrawRows.svelte` (also Settings and the bag's cog) (enforced by `e2e/game-settings.e2e.ts`)
- Choosing the script for a new game: `features/modes/ScriptPicker.svelte`: base three as chips, every other script by search, the Library in a dialog (enforced by review)
- The rules behind a screen a mode or rule opens: `features/modes/RuleHeader.svelte` with `spawnedBy(gameId, has)` (`spawned-by.ts`): name, description, Inspect (enforced by review)
- Cancel and Confirm in a modal: `ui/primitives/ModalActions.svelte` (enforced by `grim/modal-actions`)
- A file's contents (a mode file, a script's JSON): `ui/primitives/FileView.svelte`: name, Copy and Download in its header, line numbers; to start it closed, put it in a Collapsible (enforced by review)
- A JSON value as readable labelled rows (objects as rows, lists numbered, nothing as "None"): `features/reference/DataTree.svelte`, used by the Character reference's All data view; pair it with a FileView for the raw file (enforced by review)
- Report an issue from a script's own actions: `features/reports/ReportButton.svelte` (the form takes the script on screen: `offerScriptToReports`) (enforced by review)
- Sending a report to the Worker: `reportOutbox.send` (`features/reports/outbox.svelte.ts`), which saves it on the device first and sends it once the connection is back; never `sendReport` directly (enforced by `e2e/report-offline.e2e.ts`)
- A modal or full-screen panel: `ui/primitives/Dialog.svelte`; `full` and `max` scroll their content under the header (`scroll={false}` for content that pans itself); over the grimoire board its backdrop (and BottomSheet's) blurs the board (`ui/board-cover.ts`) (enforced by `e2e/dialog-scroll.e2e.ts`)
- A preview beside the settings it shows, in a dialog: `Dialog`'s `aside`: on the left once the dialog is wide enough, on top on a phone (held there unless `pinAside` is false); each pane scrolls on its own (QR code settings, Character builder) (enforced by `e2e/room.e2e.ts`)
- Choosing a saved script, character or collection: `features/library/LibraryBrowser.svelte` with `kind` and `onpick` (the Library's file manager; `PreviewToggle.svelte` is its Preview button) (enforced by review)
- A confirmation: `ui/primitives/ConfirmDialog.svelte` (enforced by `grim/confirm-dialog`)
- A text button: `ui/primitives/Button.svelte` (`solid`, `quiet`, `accent`, `danger` red fill, `field`); every variant has a 3:1 edge from the theme (`--button-edge`, `--accent-edge`, `--danger-edge`, tested in `themes.test.ts`); an `https` `href` opens in a new tab (enforced by review)
- Delete, remove, clear (not Account settings¹): `ui/primitives/DeleteButton.svelte` (enforced by `grim/delete-button`)
- The full screen toggle: `ui/primitives/FullScreenButton.svelte` on the board's toolbar (only where the browser can, never in the installed app). A part of a page that fills the screen, with the toggle in its top right corner: `ui/layout/FullScreenStage.svelte` (`corner` snippet for buttons beside it); `PlayerGrim`'s `fullScreen` uses it for /play's Grim and Public Town (enforced by `e2e/grimoire.e2e.ts`, `e2e/public-town.e2e.ts`, `e2e/room.e2e.ts`)
- A row of icon buttons (a page's title actions, a dialog header): `ui/primitives/IconButton.svelte` for every button in it; a drop-down there is `ui/primitives/Select.svelte` with `icon` (its closed control is that IconButton, as the sheet background's paint bucket); never restyle a trigger to look like one (enforced by `e2e/icon-row.ts` `expectMatchingIconRow` (`e2e/play.e2e.ts`, `e2e/game-modes.e2e.ts`))
- A picture the whole table sees (the board's background; a player's own avatar picture, `features/player/avatar-picture.svelte.ts`, put there with the phone's key by `putRoomImage`): `features/room/room-images.ts` `uploadRoomImage` from the Storyteller's device, loaded at `core/sync/room-images.ts` `roomImagePath`; the room keeps it by hash and deletes it with the room, never a picture in a room message (enforced by `e2e/public-town.e2e.ts`)
- Anything a phone tells the Storyteller (a message, a reported picture): `features/room/inbox.svelte.ts` `RoomInbox` (`roomHost().inbox`), shown in `features/room/InboxDialog.svelte`, opened with `inboxDialog.show()`; its count is `inbox.unread` (on the board's ⋯, where Messages is on every screen, and the grim cover's `InboxNotice`, which never names a sender). The room side is `core/sync/room-messages.ts` (Trevor, 2026-10-27) (enforced by review)
- How the shared grim looks (background, vignette, logo): `features/grimoire/shared-look.ts` `lookOf` / `drawnLook` with `PublicLook`; every shared grim draws the Storyteller's look, never its own device's (enforced by `e2e/public-town.e2e.ts`, `e2e/room.e2e.ts`)
- A close or dismiss X: `ui/primitives/IconButton.svelte` with `icon="close"`; the primitives' own X is `data-part="close-trigger"`, round with the shared tint (base.css) (enforced by `grim/close-button`, `e2e/mouse.e2e.ts`)
- An icon, or a button's icon: a catalogue slot (`ui/icons/catalogue.ts`) through `<Icon name>` or a button's `icon`, never an icon package; one slot per meaning: edit, rename or change in place = `edit` (the pencil); `pen` and `eraser` are the scratch pad's tools only (enforced by `grim/icon-meaning`)
- A pill button or on/off chip: `ui/primitives/Chip.svelte` (`pressed`, `marked`) (enforced by review)
- A number with − and +: `ui/primitives/Stepper.svelte` (`typeable` lets the number be typed; `oncommit` on Enter) (enforced by review)
- An icon-only link to an outside page (the wiki): `ui/primitives/IconButton.svelte` with `href` (new tab, `rel="noopener"`), so it looks and hovers like the X (enforced by `e2e/badges.e2e.ts`)
- A fair-play warning (don't screenshot, share or misuse what's shown; a spectator's promise): `features/show/FairPlayNotice.svelte` with `kind` (`secret`: a player's own character; `message`: Message the Storyteller; `watch`: Grim view's promise); every such warning's wording lives there (enforced by review)
- The Support on Ko-fi link: `features/about/KofiButton.svelte`, Ko-fi's own button image from its brand assets, never a restyled `Button` (enforced by `e2e/support.e2e.ts`)
- The notice that the app is not official: `features/about/OfficialNotice.svelte` (links bloodontheclocktower.com; Credits, privacy policy) (enforced by review)
- The notice that the app is not official: `features/about/OfficialNotice.svelte` (links bloodontheclocktower.com; About, privacy policy) (enforced by review)
- A bar pinned to the screen's bottom edge: the `pinned-bottom` class (base.css keeps its room below the page), as `features/setup/SetupNav.svelte` does (enforced by `e2e/setup.e2e.ts`)
- A random pick button: `ui/primitives/IconButton.svelte` with `icon="random"` and `Math.random` (setup, Demon bluffs) (enforced by review)
- A table filter's radio or checkbox list: `ui/table/FilterOptions.svelte` (`value`/`onpick` or `values`/`ontoggle`) (enforced by review)
- A contents list beside its text (phone: list, then detail): `ui/layout/ContentsLayout.svelte` (an item's `count` is drawn as a CountBadge; lines between entries and beside the text) (enforced by review)
- The back arrow of a list-and-detail view on a phone: `ui/primitives/BackButton.svelte` (`hideLabel` for the arrow only) (enforced by review)
- Hide contents (a note, a scratch pad, guesses on the Grim): `ui/primitives/HideContentsButton.svelte` (enforced by review)
- The grim cover (the Storyteller's opaque screen): `features/show/CoverButton.svelte` (script, night or day, timer from `CoverScreen`; PIN through `PinDialog` with `purpose="cover"`); overlays opened inside it portal into it (`ui/primitives/portal-target.ts`) (enforced by `e2e/grim-cover.e2e.ts`)
- Titled notes: cards ("+ New note"), editor, save-on-close editor (notebook, game and player notes): `ui/notes/NoteCards.svelte`, `ui/notes/NoteEditor.svelte`, `ui/notes/NoteDraftEditor.svelte` (enforced by shared)
- A number the app works out (a count beside a heading or a name, "7 of 10", ×3 copies, a token's corner count): `ui/primitives/CountBadge.svelte`, always a filled circle (Trevor, 2026-10-27: "not loose in the air"); `warn` in the accent colour, `total` for "7 of 10", `times` for "×3"; numbers in a sentence, a table cell or under their label stay text, and no message puts a count in brackets (enforced by `grim/count-badge`, `scripts/count-messages.test.ts`)
- Something is loading: `ui/primitives/Spinner.svelte` (`label` when nothing beside it says what loads) (enforced by review)
- A builder's title-row tools (open, download, clear): `ui/builder/BuilderTools.svelte` (enforced by review)
- A builder's Save and Save as new: `ui/builder/BuilderTools.svelte` with `save` (icon buttons in the header) (enforced by review)
- A builder's "Open a saved …" list: `ui/builder/OpenSavedDialog.svelte` (enforced by review)
- A table (paging, column picker, a filter on every column): `ui/table/DataTable.svelte`: each column gives `value`, `filterable` or a `noFilter` reason (`column-filter.ts`) (enforced by review)
- A character name: `features/characters/CharacterBadge.svelte` (enforced by `grim/names-as-badges`)
- An alignment in its colour (Good, Evil, Not set): `features/grimoire/AlignmentPill.svelte` (`text` for words such as "Good wins") (enforced by review)
- A night answer's set of characters (the Godfather's Outsiders in play, "+1 Outsider", "None"): `features/grimoire/CharacterSet.svelte`, in Valid Information and its Why (enforced by review)
- The board's lower left corner (script name, mode and rules, join code, night/day, Game time, watchers): `features/grimoire/BoardCorner.svelte`, its lines from `cornerLines` in `features/grimoire/corner-lines.ts`; a player's grim gets the same lines through the room (`PublicCorner`) (enforced by review)
- One player's notes: their dialog, and their entry in a list of notes: `ui/notes/SeatNotesDialog.svelte` (cards, each saved as it closes) and `features/grimoire/SeatNoteEntry.svelte`: the Storyteller's Notes sheet and a player's own seat notes (enforced by review)
- A seat's note mark (the disc on the token's lower right rim; tapping it opens the note): `ui/seating/SeatNoteMark.svelte`: the board's seats and a player's grim (enforced by review)
- A pill of small marks over a token's top rim (one tap target): `ui/seating/RimPill.svelte`: the board's nominations (top left) and a player's other guesses on their grim (top right, `features/player/GuessMarks.svelte`) (enforced by review)
- One of the day's counts as a filled badge (alive, good, evil, ghost votes, votes to block): `features/day/CountBadge.svelte`: the Storyteller's day counts (`DayCounts.svelte`) and the players' counts behind their status line (`PlayersDayStatus.svelte`), worked out by `townCounts` in `core/rules/voting.ts` from the town's view (enforced by review)
- A reminder name: `features/characters/ReminderToken.svelte` (enforced by `grim/names-as-badges`)
- One character's reminders in a reminders picker (token, name, chips that wrap), or a named row without a character (the player's Generic row): `features/characters/ReminderGroupRow.svelte`: the board's "Reminders for Seat N" (`grimoire/ReminderPicker`) and a player's own grim (`player/PlayerReminderPicker`) (enforced by review)
- A generic ∞ token's look editor (preview beside text, symbol, colour, fill; red Delete): `features/grimoire/GenericLookDialog.svelte`: the board's ∞ token (`grimoire/GenericTokenDialog`) and a player's generic tokens (`player/PlayerReminderPicker`) (enforced by review)
- A player's profile (their avatar large, laurel, colour, motion; game stats later), opened from their avatar: `features/player/PlayerProfileDialog.svelte` (rows from `seat-profile.ts`): the board's avatar mark (`grimoire/SeatProfileDialog`) and a seat sheet's avatar on /play (`player/SeatAvatarButton`) (enforced by `e2e/room.e2e.ts`)
- A player name (sheets, dialogs, History, sentences): `ui/seating/PlayerBadge.svelte`: the pill under a seat's token, inline; `seatName` (`features/game/seat-label.ts`) gives its text, the name or "Seat 3". CharacterBadge, CharacterRow and CharacterEntry draw it for `playerName` (enforced by `grim/names-as-badges` (PLAYER_BADGE_TODO))
- An entry headed by a character: `features/characters/CharacterEntry.svelte` (jinxes, announcements; a character with an ability uses CharacterRow) (enforced by review)
- Opening a saved game for a screen (loading, none, too new): `features/game/WithSavedGame.svelte` (`prepare`, `fallback` snippet) (enforced by review)
- A character picker: `features/characters/CharacterPicker.svelte` (enforced by review)
- A character as a row (token, name, ability): `features/characters/CharacterRow.svelte` (the picker, character selection via `setup/CharacterChoice.svelte`, the day's abilities, chosen bluffs, Show to player; `look="ring"` is every script sheet's row, on screen and in print, via `player/ScriptSheet.svelte`): `info` makes the token open the character page, `marks`/`end` snippets hold ticks, lock and day buttons in fixed places (enforced by review)
- A keyboard focus ring on a token: Automatic: `ui/token/TokenFace.svelte` and `ui/seating/SeatDisc.svelte` mark their faces `data-token-face`, and `ui/base.css` rings that round face instead of the box of the button or link around it (Trevor, 2026-10-23). Don't add a square `:focus-visible` outline to a token's button (enforced by review)
- End game's Winner and How it ended: `features/grimoire/EndGameFields.svelte` (menu's End game and the game end prompt) (enforced by review)
- A day or vote timer: `features/day/DayTimer.svelte` (enforced by review)
- Playing a sound or vibrating: `features/sound/sound.ts` (`playSound`, `unlockSound`, `vibrate`, `canVibrate`): one audio context and the device volume; the Vibrate switch is `features/sound/VibrateToggle.svelte` (enforced by review)
- Day and night sound (one recording per scene): `core/sound/ambience.ts` (the recordings, their credits and each scene's options) and `features/sound/ambience.ts` (`ambience.sync(scene)`, `previewAmbience`), sharing `sound.ts`'s audio context; recordings in `static/sounds/`, cached on first use (enforced by review)
- Playing a recorded sound at a tap or for an action: `features/sound/soundboard.svelte.ts` (`soundboard.play`, `toggle`, `isPlaying`, `pause`, `resume`; on Tone.js, the only place that imports it) over `features/sound/recording.ts` (fetch and decode once, shared with day and night sound); the sounds and the action rule in `core/sound/soundboard.ts` (enforced by review)
- The soundboard's mixer (level, overlap, each sound's volume and loop): `features/sound/SoundboardSettings.svelte`, in Settings > Sound and in the Soundboard dialog (`master` adds the device volume) (enforced by review)
- Which sounds and mixes the soundboard shows (hot spots): `features/sound/SoundPadsDialog.svelte`, from the Soundboard's Edit and "+ New" pad and from Settings > Sound; pads are `SoundPad` in `core/sound/soundboard.ts` (`parsePads`, `padSounds`, `padName`) (enforced by review)
- Soundboard sounds on the Public Town tablet (Play on): the room's `town-sound` message (`core/sync/room-sound.ts`, `parseTownSound`), sent by `soundboard.town` (connected by `features/sound/SoundboardDialog.svelte`) and played by `features/sound/town-sounds.ts` with `soundboard.fromStoryteller` (enforced by review)
- The speaker every sound plays on: `features/sound/SpeakerSetting.svelte` over `features/sound/speaker.svelte.ts` (`canChooseSpeaker`, `useSpeaker`); `audio()` applies the saved one (enforced by review)
- The time left on something the room times (the script vote, a Room transfer's code): `features/room/VoteTimeLeft.svelte` (Storyteller's vote sheet, each phone's ballot, Room transfer; `text`/`endedText` for its own words) (enforced by review)
- A script's details: `features/scripts/ScriptView.svelte` (enforced by review)
- A script's logo: `features/scripts/ScriptLogo.svelte` with `scriptLogo` (`core/data/script-logo.ts`) (enforced by review)
- A script's logo faint in the middle of a board, or its name when it has no logo: `features/scripts/BoardLogo.svelte`, on the Storyteller's board, every player's grim and the Board settings preview (enforced by review)
- Reading and writing localStorage: `ui/stored.ts` (`readStored`, `writeStored`, `readParsed`, `readStoredText`, `writeStoredText`) (enforced by `no-restricted-globals` (localStorage))
- Copying text, with its toast: `ui/clipboard.ts` (`copyText`) (enforced by review)
- Every request to a server: `ui/fetch.ts` (`fetchJson`, `fetchWithTimeout`), which gives up after a timeout (10 s, or `SLOW_FETCH_TIMEOUT_MS` for uploads and large files) (enforced by `no-restricted-syntax` (fetch))
- Every Share button (code, QR, link, Copy, refresh, Share, send a file): `ui/share/SharePanel.svelte`; a script's Share is `features/scripts/ShareControl.svelte`, which shows the room's link and join code when the device is in a room, and its link comes from `scriptShareable` (`features/scripts/share-codes.ts`) (enforced by `grim/share-panel` (`SHARE_TODO`), `e2e/share.e2e.ts`)
- A code to type on another device, large under its header with Copy (the share screen's room code, Room transfer's code): `ui/share/ShareCode.svelte` (enforced by review)
- A copy icon that shows a check for a moment (the share screen's code and link, Grim view's password): `ui/share/CopyButton.svelte` over `copyText` (`ui/clipboard.ts`) (enforced by review)
- The player screen's tabs (Script, Night, Grim, Notes): `features/player/PlayerScreen.svelte`, which sets up `PlayerScriptTabs`, `PlayerGrim` (with Full screen) and `PlayerNotes` once. /play and the Storyteller's player view (board Script sheet, grim cover's Player view) both render it, never those pieces themselves, so a new player feature shows on both (Trevor, 2026-10-28); a Public Town display (/town) shows `PlayerGrim` with `display` (enforced by `player-view-parity.test.ts`, `e2e/player-view-parity.e2e.ts`)
- The script's title-line buttons (Message the Storyteller, sheet background, Print, Share, the player's settings cog): `features/player/PlayerScriptActions.svelte`, with `features/room/YouButton.svelte` as an `IconButton`: /play's title line and the board's Script sheet header, so the Storyteller sees the players' exact buttons (Trevor, 2026-10-26); the Storyteller's copy passes `storyteller`, so a phone's room buttons show there without acting as a player (enforced by `e2e/play.e2e.ts`, `e2e/game-modes.e2e.ts`, `e2e/player-view-parity.e2e.ts`)
- A player's avatar (their initials) on a token face: `ui/seating/AvatarFace.svelte`; ids and `initialsOf` in `core/avatars` (enforced by review)
- A setting in Settings (or where it is used): a row, a switch, a colour, a heading over a run, a closing group: `ui/settings/` `SettingRow` (and `SettingToggle`, `SettingSelect`, `SettingSlider`, `SettingChoice`, `SettingColor`), `SettingHeading`, `SettingCollapsible`, `SettingGroup` (with a preview); each carries `data-setting`, and `ui/base.css` draws the line between any two (enforced by `e2e/settings-framework.e2e.ts`)
- Finding a setting: Settings' search (`features/settings/settings-search.ts`) reads every `data-search-label` (and `data-search-description`) the `ui/settings/` rows carry, so a new setting built from them is found with no list to update; a hand-made setting element adds the attribute itself (enforced by `e2e/settings-search.e2e.ts`)
- Text size and Pinch to zoom outside Settings (the player screen's settings cog): `features/settings/sections/TextSizeRows.svelte` (Settings > Text uses it too) (enforced by `e2e/play.e2e.ts`)
- Text size outside Settings (the player screen's settings cog): `features/settings/sections/TextSizeRows.svelte` (Settings > Text uses it too) (enforced by `e2e/play.e2e.ts`)
- A token size or switch (character, reminder, names and reminders in text) as a setting row: `features/characters/TokenAppearanceRow.svelte` (keys in `token-appearance-rows.ts`), and the player name size: `features/grimoire/NameSizeSlider.svelte`; Settings > Tokens draws them, never their own slider. Players reach them there too: the player screen's and Public Town's cogs open the one Settings at its list of sections (Trevor, 2026-10-27: one Settings everywhere)
- Reading a QR code with the camera: `ui/share/QrScanner.svelte` (`ui/share/qr-reader.ts`: BarcodeDetector, else jsQR) (enforced by review)
- Text too long for one QR code (an animated code): `core/codes/qr-frames.ts` (`qrFrames`, `QrFrameCollector`); shown by `frames` on `ui/share/SharePanel`, read through `ui/share/QrScanner.svelte` (`progress`) (enforced by `e2e/offline-share.e2e.ts`)
- A fake phone camera in an e2e test: `e2e/camera.ts` (`aimCamera`, one picture or frames in turn) (enforced by review)
- A script's logo, or its name, in a QR code's middle: `features/scripts/ScriptQrCenter.svelte` (`qrCenter` on `ui/share/SharePanel`, `center` on `ui/primitives/QrCode`) (enforced by review)
- A QR code, in any of its shapes, with a middle on whole squares: `ui/primitives/QrCode.svelte` (`modules`, `finders`; `qr-pattern.ts` draws, `qr-centre.ts` places the middle) (enforced by review)
- The Storyteller's own picture in a QR code's middle, and its settings: `ui/share/QrPicture.svelte`; `ui/share/QrCentreSetting.svelte` (Settings > Storyteller and the share screen) (enforced by review)
- A seat named in a sentence ("Seat 3 (Alex)"): `features/game/seat-label.ts` (`seatLabel`) (enforced by review)
- Saving a file to the device: `ui/download.ts` (`downloadJson`, `downloadFile`, `fileNameFor`) (enforced by review)
- Pixel sizes: `var(--u)` and tokens (enforced by `npm run lint:px`)
- Colours: theme tokens; no hex, colour functions or named colours (`white`) outside the themes; mixes, washes and fixed looks (print paper, ghost vote) are tokens in `ui/tokens/components.css`; a sheet's colours come from the sheet scope there (enforced by `npm run lint:colors`)

¹ Account settings (`features/account/AccountPage.svelte`) is exempt from `grim/delete-button` (Trevor, 2026-10-18): Sign out is a text button, and Delete account a labelled red button.

## Character rules as data

Each character's rules live in one rules block (Trevor, 2026-10-22): `src/lib/core/data/rules/<id>.json`
for official characters (TPI's `roles.json` stays untouched), or `rules` in a custom
character's script entry. Both are read by `parseCharacterRules`
(`src/lib/core/data/character-rules.ts`), and `rulesOf` returns a character's block. A new entry for
a moved table goes in the character's file, never in a TypeScript table. Rules code names no
character: a rule becomes a behaviour with parameters that any character can use.

- Reminder prompts (`rules/reminder-prompts.ts`): `reminderPrompts`, moved
- Reminder targets (`reminder-targets.ts`): `reminderTargets`, moved
- Day reminders (`day-reminders.ts`: also registration interactions such as the Spy and the Virgin): `dayReminders`, moved
- Setup reminders and preparation notes (`setup-reminders.ts`): `setupPrep`, moved
- Setup counts (`setup-modifiers.ts`: the Baron, Godfather, Legion and the rest): `setupModifier`, moved
- Death causes (`death-causes.ts`: who can cause a death and whom): `deathCause`, moved
- Reminder movement (`reminder-movement.ts`: tokens that stay put, characters that relocate them, and `followsNeighbours` tokens that move to the new neighbours when players change seats): `reminderMovement`, moved
- Reminder placeholders (`night-text.ts`: what each `:reminder:` in the night text means): `reminderPlaceholders`, moved
- Night text overrides (`night-text.ts`: Trevor's reviewed edits and the parked fuller text): `nightText`, moved
- Info token characters (`info-token-characters.ts`: the character a night step's card always shows): `infoTokenCharacters`, new
- On-death triggers (`night-alerts.ts` `ON_DEATH`): `onDeath`, moved
- Protection (`ability.ts`, `night-alerts.ts`; `not-execution` for the Storm Catcher, `whileNeighboursGood` for the Tea Lady, `day` for the Vizier, flagged by day in a seat's Status by `validDeathCauses`): `protects`, moved
- On-death triggers (`night-alerts.ts` `ON_DEATH`; `onDeathApplies` reads `by` and `night` against the death cause): `onDeath`, moved
- Protection (`ability.ts`, `night-alerts.ts`): `protects`, moved
- Impairments (`ability.ts`, read by `impairs-rules.ts`: the Drunk, Witch, Minstrel, Preacher, Xaan; Barista's `clears`; other tokens end with their character unless an entry says they last): `impairs`, moved
- Registration (`ability.ts`: the Spy, Recluse and Lycanthrope's Faux Paw; `asAnything` and `whileToken` for the Revolutionary's pair until Register Falsely? comes off): `registersAs`, moved
- Night killers (`night-alerts.ts` `NIGHT_KILLERS`): `kills`, moved
- Death checks (`night-deaths.ts`: the Gambler, Acrobat, Lycanthrope and Grandmother): `deathCheck`, moved
- Kill redirect and first-death survival (`ability.ts`, `first-death.ts`): `redirectsKill`, `survivesFirstDeath`, moved
- Nomination abilities (`rules/nominations.ts`): `onNominated`, `afterDeath`, moved
- Acts when dead (`dead-characters.ts`): `actsWhenDead`, moved
- Stops waking (`night-alerts.ts`: the Exorcist's Chosen on the Demon): `stopsWaking`, new
- Stops killing (`night-alerts.ts`: the Princess's Doesn't Kill on the Demon): `stopsKilling`, new
- Own wake conditions (`rules/wakes-when.ts`, read by `night-steps.ts` `stepWakes`: the King once the dead equal or outnumber the living, the Choirboy when the Demon killed the King, the Seamstress until her No Ability): `wakesWhen`, new
- Keeps its ability when dead (`dead-characters.ts`: the Vigormortis's Has Ability on a Minion it killed): `keepsAbility`, new
- Abilities gained from another player (`gained-abilities.ts`, was the Pixie hard-code and `GAINED_FROM` in `death-causes.ts`: the Cannibal's Lunch, the Pixie's Mad and Has Ability, the Philosopher's swap or Drunk): `gainedFrom`, moved
- Character and alignment changes (`becomes.ts`, was `BECOMES_DEMON`: the Scarlet Woman's Is The Demon, the Mezepheles's Turns Evil, the Snake Charmer's swap): `becomes`, moved. A Demon's death by its own kill passing it on (the Imp, the Fang Gu) is `gameEnd` `death-passes`, asked by `StarPassPrompt`. Making a chosen player a Demon on the night a token marks (the Summoner's Night 3) is `makesDemon`, asked by `MakeDemonStep` in its night step.
- Claims players make by day (Juggler guesses, Gossip and Savant statements; new, L56): `dayClaim`, `guessLimit`, moved
- Day marks (`rules/day-marks.ts`: Demon voted, Minion nominated, with their tokens; new): `dayMark`, moved
- Night information and answers (`night-info.ts`): `learns`, `answers`, moved
- Game end (`game-end.ts`, `end-reason.ts`): `gameEnd`, moved
- Extra evil makers (`modes/draft.ts` Ivory draft; the kind the Spirit of Ivory limits; new): `makesExtraEvil`, new
- Hidden character it may really be (`modes/draft.ts`, the Atheist's Drunk; new): `orHiddenAs`, new
- Gained not-in-play ability (`modes/draft.ts`, the Alchemist's Minion; new): `gainsAbilityOf`, new
- Players turned into another type (`modes/draft-seats.ts`: Kazali, Lord of Typhon, Lil' Monsta): `turnsPlayersInto`, new
- Evil info step notes (`night-order.ts` `markerNotes`: Poppy Grower, Magician, Lunatic, Toymaker, Summoner, Snitch) and who may hide the Demon from Minions (Savant): `evilInfo`, moved
- Savant statements (`savant-facts.ts`, `savant-templates.ts`, `savant-log-templates.ts`): reminders marking whom it chose (was `MINION_CHOICES`, `TOWNSFOLK_CHOICES`) `marksChoice`; number or once-per-game info (was `NUMBER_INFO`, `ONCE_INFO`) `infoKind`; the Witch's curse `curses`; the Lunatic's `choosesLikeDemon` and `believesOtherCharacter`; the Snake Charmer's `choosesUnmarked`; all moved (`choice-rules.ts`)

## Lists that only shrink

Some lints start with a list of files written before the lint (for example
`LOCAL_STORAGE_TODO` in `eslint.config.js`). Move a file onto the shared piece and take it off
the list. Never add a file to one.

`TRAIT_TODO` in `src/lib/core/rules/trait-coverage.test.ts` lists official characters whose
ability text names a mechanic (poison or drunk, can't die, registers, kills, dies) that no rule
encodes, each with why. Give a new character the rule rather than an entry; take an entry off
once its rule exists.

`npm run lint:lines` (`scripts/check-lines.ts`) keeps every source file at 800 lines or fewer
(tests, `*.data.ts` rules tables, i18n catalogs and generated files aside). Its
`LARGE_FILE_TODO` holds the files that were longer when it began; split one into modules with a
small surface and take it off the list (a stale entry is reported, not a failure, so
parallel splits never break each other). The plan for each is in the project's
`refactor/large-files.md`.

`npm run lint:knip` (`knip.jsonc`) fails on a file, an exported value or a dependency nothing
uses. Delete it, or drop the `export` when only its own file uses it; an export kept on
purpose for later says why with `@public` in its doc comment.

## Still to share

The open items, with owners, are in the project's component review
(`component-review/consolidation-plan.md` in the shared project files).
