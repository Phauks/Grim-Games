/**
 * Icon slots (04-architecture.md §9, 06-visuals-and-ui-kit.md §5).
 *
 * Features ask for a concept (`<Icon name="dead" />`), never an icon id. A slot resolves to
 * an Iconify id through: user override -> theme map -> catalogue default, and the chosen
 * icon set (a Phosphor weight) is applied last. Only the icons listed here (defaults and
 * curated alternatives, in every offered weight) are compiled into the bundle, so the
 * pickers in Settings work offline. After editing this file run `npm run icons`.
 */

export interface IconSlotInfo {
	label: string;
	/** Iconify ids offered for this slot; the first is the default. */
	choices: readonly [string, ...string[]];
}

export const ICON_SLOTS = {
	alive: { label: 'Alive', choices: ['ph:heartbeat', 'ph:heart'] },
	dead: { label: 'Dead', choices: ['ph:skull', 'ph:cross', 'ph:x-circle'] },
	ghostVote: { label: 'Ghost vote', choices: ['ph:ghost', 'ph:hand-pointing'] },
	poisoned: { label: 'Poisoned', choices: ['ph:flask', 'ph:drop'] },
	drunk: { label: 'Drunk', choices: ['ph:beer-stein', 'ph:wine', 'ph:beer-bottle'] },
	protected: { label: 'Protected', choices: ['ph:shield', 'ph:shield-check', 'ph:shield-star'] },
	night: { label: 'Night', choices: ['ph:moon-stars', 'ph:moon'] },
	day: { label: 'Day', choices: ['ph:sun', 'ph:sun-horizon'] },
	/**
	 * The script and night order sheets' background colour, beside Print and Share: a paint
	 * bucket, drawn like the icon buttons next to it (Trevor, 2026-10-26).
	 */
	sheetBackground: {
		label: 'Sheet background',
		choices: ['ph:paint-bucket', 'ph:palette']
	},
	vote: { label: 'Vote', choices: ['ph:hand-palm', 'ph:hand-fist'] },
	/** Players needed to exile a Traveller (Trevor, 2026-10-28). */
	exile: { label: 'Exile', choices: ['ph:door', 'ph:sign-out'] },
	nominator: { label: 'Has nominated', choices: ['ph:hand-pointing', 'ph:megaphone'] },
	nominated: { label: 'Was nominated', choices: ['ph:gavel', 'ph:scales'] },
	demon: { label: 'Demon', choices: ['ph:mask-sad', 'ph:smiley-angry', 'ph:fire'] },
	bag: { label: 'Bag', choices: ['ph:handbag', 'ph:tote', 'ph:bag-simple'] },
	reminder: { label: 'Reminder', choices: ['ph:push-pin', 'ph:bookmark-simple', 'ph:tag'] },
	players: { label: 'Players', choices: ['ph:users-three', 'ph:users'] },
	script: { label: 'Script', choices: ['ph:scroll', 'ph:book-open'] },
	buildScript: { label: 'Script builder', choices: ['ph:hammer', 'ph:wrench'] },
	buildCharacter: { label: 'Character builder', choices: ['ph:user-gear', 'ph:user-plus'] },
	installApp: { label: 'Install app', choices: ['ph:device-mobile', 'ph:download-simple'] },
	download: { label: 'Download', choices: ['ph:download-simple', 'ph:file-arrow-down'] },
	open: { label: 'Open', choices: ['ph:folder-open', 'ph:folder'] },
	notes: { label: 'Notes', choices: ['ph:note-pencil', 'ph:notepad', 'ph:feather'] },
	undo: { label: 'Undo', choices: ['ph:arrow-counter-clockwise', 'ph:arrow-u-up-left'] },
	refresh: { label: 'Refresh', choices: ['ph:arrow-clockwise'] },
	redo: { label: 'Redo', choices: ['ph:arrow-clockwise', 'ph:arrow-u-up-right'] },
	reset: {
		label: 'Reset to default',
		choices: ['ph:arrow-counter-clockwise']
	},
	add: { label: 'Add', choices: ['ph:plus', 'ph:plus-circle'] },
	minus: { label: 'Minus', choices: ['ph:minus', 'ph:minus-circle'] },
	resume: { label: 'Resume game', choices: ['ph:play-circle', 'ph:play'] },
	/** The day timer (Trevor, 2026-10-17). */
	timerStart: { label: 'Start timer', choices: ['ph:play', 'ph:play-circle'] },
	timerPause: { label: 'Pause timer', choices: ['ph:pause', 'ph:pause-circle'] },
	timer: { label: 'Timer', choices: ['ph:timer', 'ph:hourglass'] },
	loading: { label: 'Loading', choices: ['ph:circle-notch', 'ph:spinner'] },
	sound: { label: 'Sound', choices: ['ph:speaker-high', 'ph:bell'] },
	/** The Storyteller's soundboard (plan U6): bells at a tap. */
	soundboard: { label: 'Soundboard', choices: ['ph:bell-simple-ringing', 'ph:bell'] },
	/** Holds the soundboard and day and night sound where they are (Trevor, 2026-10-27). */
	soundPause: { label: 'Pause sound', choices: ['ph:pause', 'ph:pause-circle'] },
	soundResume: { label: 'Resume sound', choices: ['ph:play', 'ph:play-circle'] },
	home: { label: 'Home', choices: ['ph:house', 'ph:house-simple'] },
	settings: { label: 'Settings', choices: ['ph:gear', 'ph:gear-six', 'ph:sliders'] },
	account: { label: 'Account', choices: ['ph:user-circle', 'ph:user'] },
	friends: { label: 'Friends', choices: ['ph:handshake', 'ph:address-book'] },
	appearance: { label: 'Appearance', choices: ['ph:palette', 'ph:paint-brush'] },
	language: { label: 'Language', choices: ['ph:translate', 'ph:globe'] },
	fonts: { label: 'Fonts', choices: ['ph:text-aa', 'ph:text-t'] },
	icons: { label: 'Icons', choices: ['ph:shapes', 'ph:smiley'] },
	/** Board and Tokens settings, each its own (Trevor, 2026-10-19). */
	boardSettings: { label: 'Board settings', choices: ['ph:circle-dashed', 'ph:circles-three'] },
	tokenSettings: { label: 'Token settings', choices: ['ph:poker-chip', 'ph:coin'] },
	close: { label: 'Close', choices: ['ph:x', 'ph:x-circle'] },
	menu: { label: 'Menu', choices: ['ph:list', 'ph:dots-three-vertical'] },
	info: { label: 'Info', choices: ['ph:info', 'ph:question'] },
	about: { label: 'About', choices: ['ph:identification-card', 'ph:info'] },
	/** The Credits page: who made what the app uses (Trevor, 2026-10-28). */
	credits: { label: 'Credits', choices: ['ph:scroll', 'ph:certificate'] },
	/** The Support page and its Ko-fi button (Trevor, 2026-10-26). */
	support: { label: 'Support', choices: ['ph:coffee', 'ph:hand-coins'] },
	back: { label: 'Back', choices: ['ph:caret-left', 'ph:arrow-left'] },
	forward: { label: 'Forward', choices: ['ph:caret-right', 'ph:arrow-right'] },
	/** The arrow on a player's guess pill: the next guess becomes the main one (Trevor, 2026-10-25). */
	nextGuess: { label: 'Next guess', choices: ['ph:arrows-clockwise', 'ph:arrow-circle-right'] },
	check: { label: 'Selected', choices: ['ph:check'] },
	random: { label: 'Random selection', choices: ['ph:shuffle', 'ph:dice-five'] },
	/** Deal at random on the Draw page: the bag split out to the seats, not the shuffle of Random selection (Trevor, 2026-10-29). */
	deal: { label: 'Deal at random', choices: ['ph:arrows-split', 'ph:cards'] },
	clearSelection: { label: 'Clear selection', choices: ['ph:eraser', 'ph:x-circle'] },
	selectedOnly: { label: 'Show only selected', choices: ['ph:list-checks', 'ph:check-square'] },
	expand: { label: 'Show or hide a section', choices: ['ph:caret-down', 'ph:caret-circle-down'] },
	wiki: { label: 'Wiki link', choices: ['ph:arrow-square-out', 'ph:book-open-text'] },
	openInNewTab: { label: 'Open in a new tab', choices: ['ph:arrow-square-out'] },
	search: { label: 'Search', choices: ['ph:magnifying-glass'] },
	print: { label: 'Print', choices: ['ph:printer'] },
	pasteJson: { label: 'Paste JSON', choices: ['ph:clipboard-text', 'ph:clipboard'] },
	uploadFile: { label: 'Upload file', choices: ['ph:upload-simple', 'ph:file-arrow-up'] },
	pasteLink: { label: 'Paste link', choices: ['ph:link', 'ph:link-simple'] },
	changeKind: { label: 'Change kind', choices: ['ph:swap', 'ph:arrows-left-right'] },
	unlink: { label: 'Unlink', choices: ['ph:link-break', 'ph:link-simple-break'] },
	quickPlay: { label: 'Play script', choices: ['ph:play', 'ph:play-circle'] },
	report: { label: 'Report a problem', choices: ['ph:bug', 'ph:flag'] },
	switchBuild: { label: 'Switch build', choices: ['ph:arrows-left-right', 'ph:swap'] },
	reference: { label: 'Character reference', choices: ['ph:books', 'ph:book-bookmark'] },
	glossary: { label: 'Glossary', choices: ['ph:book-open-text', 'ph:list-magnifying-glass'] },
	warning: { label: 'Warning', choices: ['ph:warning', 'ph:warning-circle'] },
	sort: { label: 'Sort', choices: ['ph:arrows-down-up'] },
	columns: { label: 'Columns', choices: ['ph:sliders-horizontal', 'ph:list-dashes'] },
	sortAscending: { label: 'Sorted ascending', choices: ['ph:caret-up', 'ph:sort-ascending'] },
	sortDescending: { label: 'Sorted descending', choices: ['ph:caret-down', 'ph:sort-descending'] },
	filter: { label: 'Filter', choices: ['ph:funnel'] },
	/** Characters a game keeps out (game modes' Restricted characters). */
	restricted: { label: 'Restricted characters', choices: ['ph:prohibit', 'ph:prohibit-inset'] },
	assistance: { label: 'Storyteller', choices: ['ph:lifebuoy', 'ph:hand-heart'] },
	remove: { label: 'Remove', choices: ['ph:trash', 'ph:trash-simple'] },
	save: { label: 'Save', choices: ['ph:bookmark-simple', 'ph:floppy-disk'] },
	swap: { label: 'Swap seats', choices: ['ph:arrows-left-right', 'ph:swap'] },
	alignment: { label: 'Change alignment', choices: ['ph:yin-yang', 'ph:scales'] },
	/**
	 * Every edit, rename or change-in-place button: the one pencil (Trevor, 2026-10-23). Was
	 * `rename` until then; saved overrides under that name still load (preferences.ts).
	 */
	edit: { label: 'Edit', choices: ['ph:pencil-simple', 'ph:user-switch'] },
	move: { label: 'Move', choices: ['ph:arrow-bend-up-right'] },
	/** One place higher or lower in a list the user orders, e.g. a ranked ballot (2026-10-26). */
	moveUp: { label: 'Move up', choices: ['ph:arrow-up', 'ph:caret-up'] },
	moveDown: { label: 'Move down', choices: ['ph:arrow-down', 'ph:caret-down'] },
	traveller: { label: 'Traveller', choices: ['ph:person-simple-walk', 'ph:user-plus'] },
	fabled: { label: 'Fabled and Loric', choices: ['ph:sparkle'] },
	grimoire: { label: 'Grimoire', choices: ['ph:users-four', 'ph:circle-dashed'] },
	arrange: { label: 'Arrange seats', choices: ['ph:arrows-out-cardinal', 'ph:hand-grabbing'] },
	more: { label: 'More actions', choices: ['ph:dots-three', 'ph:dots-three-vertical'] },
	history: { label: 'History', choices: ['ph:clock-counter-clockwise', 'ph:list-bullets'] },
	join: { label: 'Join game', choices: ['ph:sign-in', 'ph:door-open'] },
	share: { label: 'Share', choices: ['ph:share-network', 'ph:qr-code'] },
	/** Reads a QR code with the camera (Join game). */
	scan: { label: 'Scan a code', choices: ['ph:camera', 'ph:scan'] },
	copy: { label: 'Copy', choices: ['ph:copy', 'ph:copy-simple'] },
	data: { label: 'Data', choices: ['ph:database', 'ph:hard-drives'] },
	/** The scratch pad's drawing tool only; an edit button is `edit` (grim/icon-meaning). */
	pen: { label: 'Pen', choices: ['ph:pen-nib', 'ph:pencil-simple-line'] },
	eraser: { label: 'Eraser', choices: ['ph:eraser'] },
	/** Locks a scratch pad so a stray touch can't draw on it. */
	lock: { label: 'Lock', choices: ['ph:lock-simple', 'ph:lock'] },
	/** Hides what is written, e.g. a scratch pad's preview in the notes list. */
	hide: { label: 'Hide', choices: ['ph:eye-slash', 'ph:eye-closed'] },
	/** Shows what is masked, e.g. a password as it is typed. */
	show: { label: 'Show', choices: ['ph:eye'] },
	library: { label: 'Library', choices: ['ph:bookmarks-simple', 'ph:archive'] },
	folder: { label: 'Folder', choices: ['ph:folder', 'ph:folder-simple'] },
	tag: { label: 'Tag', choices: ['ph:tag', 'ph:tag-simple'] },
	/** Shows or hides the Library's preview beside the list. */
	preview: { label: 'Preview', choices: ['ph:sidebar-simple', 'ph:square-split-horizontal'] },
	/** Opens an item from its preview into a window over the page. */
	openItem: { label: 'Open', choices: ['ph:arrow-square-out', 'ph:frame-corners'] },
	fullScreen: { label: 'Full screen', choices: ['ph:arrows-out', 'ph:corners-out'] },
	exitFullScreen: { label: 'Exit full screen', choices: ['ph:arrows-in', 'ph:corners-in'] },
	showToPlayer: { label: 'Show to player', choices: ['ph:eye', 'ph:device-mobile'] },
	/** Covers the whole screen, so a glance at it shows nothing (Trevor, 2026-10-26); a screen
	 * pulled down over the board (Trevor, 2026-10-27: "I do like projector screen. Feels like a
	 * cover"). */
	cover: { label: 'Cover the screen', choices: ['ph:projector-screen', 'ph:monitor'] },
	/** A shared grim drawn in the Storyteller's board's shape (Trevor, 2026-10-27). */
	boardShape: { label: "Storyteller's board shape", choices: ['ph:crop', 'ph:selection'] },
	/** Someone is watching the view-only grimoire (Trevor, 2026-10-20). */
	watchers: { label: 'Watching', choices: ['ph:eye', 'ph:binoculars'] },
	/** Players' feedback on a finished game (Trevor, 2026-10-25). */
	feedback: { label: 'Player feedback', choices: ['ph:star-half', 'ph:chat-centered-text'] },
	/** Players' messages to the Storyteller, and the Storyteller's Messages (Trevor, 2026-10-27). */
	messages: { label: 'Messages', choices: ['ph:chat-text', 'ph:envelope-simple'] },
	/** A player's phone on Players (Trevor, 2026-10-30: "a checkmark, x or none or some other symbols"). */
	phoneHere: { label: 'Phone here', choices: ['ph:check-circle', 'ph:device-mobile'] },
	phoneAway: { label: 'Phone away', choices: ['ph:moon', 'ph:clock'] },
	noPhone: { label: 'No phone', choices: ['ph:minus-circle', 'ph:minus'] },
	roleSeen: { label: 'Has seen their character', choices: ['ph:eye', 'ph:check'] },
	/** Seating on the grim (plan J38): phones may move their own seat, until it is locked. */
	openSeating: { label: 'Open seating', choices: ['ph:lock-simple-open', 'ph:lock-open'] },
	lockSeating: { label: 'Lock seating', choices: ['ph:lock-simple', 'ph:lock'] },
	/** Room transfer: the room goes to another Storyteller's device (Trevor, 2026-10-28). */
	transfer: { label: 'Room transfer', choices: ['ph:hand-arrow-up', 'ph:arrow-square-out'] },
	/** Marks an opened message unread again (Trevor, 2026-10-28: "an eyeball next to the x"). */
	markUnread: { label: 'Mark as unread', choices: ['ph:eye', 'ph:eye-closed'] },
	/** What an info token asks for when shown, on its tile (Trevor, 2026-10-18). */
	asksText: { label: 'Asks for words', choices: ['ph:text-t', 'ph:textbox'] },
	asksNumber: { label: 'Asks for a number', choices: ['ph:hash', 'ph:calculator'] },
	asksChoices: { label: 'Asks for an answer', choices: ['ph:list-bullets', 'ph:list-checks'] },
	asksCharacters: { label: 'Asks for characters', choices: ['ph:user-circle', 'ph:users'] },
	/** The one-time info token, used once and never saved. */
	quickCard: { label: 'Quick card', choices: ['ph:lightning', 'ph:timer'] }
} as const satisfies Record<string, IconSlotInfo>;

export type IconSlot = keyof typeof ICON_SLOTS;
export const iconSlots = Object.keys(ICON_SLOTS) as IconSlot[];

/** Phosphor weights; each one is a user-selectable icon set. */
export const PHOSPHOR_WEIGHTS = ['regular', 'thin', 'light', 'bold', 'fill', 'duotone'] as const;
export type PhosphorWeight = (typeof PHOSPHOR_WEIGHTS)[number];

export interface IconSet {
	id: IconSetId;
	label: string;
	weight: PhosphorWeight;
}

export type IconSetId = `ph-${PhosphorWeight}`;

export const ICON_SETS: readonly IconSet[] = PHOSPHOR_WEIGHTS.map((weight) => ({
	id: `ph-${weight}`,
	label: weight[0].toUpperCase() + weight.slice(1),
	weight
}));

export function isIconSetId(value: unknown): value is IconSetId {
	return ICON_SETS.some((set) => set.id === value);
}

export function isIconChoice(slot: IconSlot, id: unknown): id is string {
	return (ICON_SLOTS[slot].choices as readonly string[]).includes(id as string);
}

/** Applies a Phosphor weight to a base id: `ph:skull` + fill -> `ph:skull-fill`. */
export function withWeight(id: string, weight: PhosphorWeight): string {
	if (!id.startsWith('ph:') || weight === 'regular') return id;
	return `${id}-${weight}`;
}

/**
 * Shapes for face-down bag tiles (Settings > Bag tile labels > Symbols). Not slots: each one
 * is a mark, not a concept the user re-picks.
 */
export const TILE_SYMBOL_ICONS = [
	'ph:star',
	'ph:moon',
	'ph:sun',
	'ph:heart',
	'ph:spade',
	'ph:club',
	'ph:diamond',
	'ph:triangle',
	'ph:square',
	'ph:hexagon',
	'ph:lightning',
	'ph:flower',
	'ph:leaf',
	'ph:anchor',
	'ph:crown',
	'ph:key',
	'ph:bell',
	'ph:feather',
	'ph:eye',
	'ph:fish',
	'ph:bird',
	'ph:cat',
	'ph:tree',
	'ph:snowflake',
	'ph:umbrella'
] as const;

/** Each slot's default base Iconify id, deduplicated and sorted: what most screens draw. */
export function defaultIconIds(): string[] {
	return [...new Set(iconSlots.map((slot) => ICON_SLOTS[slot].choices[0]))].sort();
}

/** Every base Iconify id offered by the catalogue, deduplicated and sorted. */
export function catalogueIconIds(): string[] {
	const ids = new Set<string>([...TILE_SYMBOL_ICONS]);
	for (const slot of iconSlots) for (const id of ICON_SLOTS[slot].choices) ids.add(id);
	return [...ids].sort();
}
