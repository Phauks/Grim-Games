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
	vote: { label: 'Vote', choices: ['ph:hand-palm', 'ph:hand-fist'] },
	demon: { label: 'Demon', choices: ['ph:mask-sad', 'ph:smiley-angry', 'ph:fire'] },
	bag: { label: 'Bag', choices: ['ph:handbag', 'ph:tote', 'ph:bag-simple'] },
	reminder: { label: 'Reminder', choices: ['ph:push-pin', 'ph:bookmark-simple', 'ph:tag'] },
	/** A reminder token placed at setup (Reference); the flower echoes the tokens' setup flower. */
	setup: { label: 'Setup', choices: ['ph:flower', 'ph:flower-lotus'] },
	players: { label: 'Players', choices: ['ph:users-three', 'ph:users'] },
	script: { label: 'Script', choices: ['ph:scroll', 'ph:book-open'] },
	buildScript: { label: 'Script builder', choices: ['ph:hammer', 'ph:wrench'] },
	buildCharacter: { label: 'Character builder', choices: ['ph:user-gear', 'ph:user-plus'] },
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
	home: { label: 'Home', choices: ['ph:house', 'ph:house-simple'] },
	settings: { label: 'Settings', choices: ['ph:gear', 'ph:gear-six', 'ph:sliders'] },
	account: { label: 'Account', choices: ['ph:user-circle', 'ph:user'] },
	appearance: { label: 'Appearance', choices: ['ph:palette', 'ph:paint-brush'] },
	fonts: { label: 'Fonts', choices: ['ph:text-aa', 'ph:text-t'] },
	icons: { label: 'Icons', choices: ['ph:shapes', 'ph:smiley'] },
	close: { label: 'Close', choices: ['ph:x', 'ph:x-circle'] },
	menu: { label: 'Menu', choices: ['ph:list', 'ph:dots-three-vertical'] },
	info: { label: 'Info', choices: ['ph:info', 'ph:question'] },
	about: { label: 'About', choices: ['ph:identification-card', 'ph:info'] },
	back: { label: 'Back', choices: ['ph:caret-left', 'ph:arrow-left'] },
	forward: { label: 'Forward', choices: ['ph:caret-right', 'ph:arrow-right'] },
	check: { label: 'Selected', choices: ['ph:check'] },
	random: { label: 'Random selection', choices: ['ph:shuffle', 'ph:dice-five'] },
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
	reference: { label: 'Character reference', choices: ['ph:books', 'ph:book-bookmark'] },
	glossary: { label: 'Glossary', choices: ['ph:book-open-text', 'ph:list-magnifying-glass'] },
	warning: { label: 'Warning', choices: ['ph:warning', 'ph:warning-circle'] },
	sort: { label: 'Sort', choices: ['ph:arrows-down-up'] },
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
	rename: { label: 'Rename', choices: ['ph:pencil-simple', 'ph:user-switch'] },
	move: { label: 'Move', choices: ['ph:arrow-bend-up-right'] },
	traveller: { label: 'Traveller', choices: ['ph:person-simple-walk', 'ph:user-plus'] },
	fabled: { label: 'Fabled and Loric', choices: ['ph:sparkle'] },
	grimoire: { label: 'Grimoire', choices: ['ph:users-four', 'ph:circle-dashed'] },
	arrange: { label: 'Arrange seats', choices: ['ph:arrows-out-cardinal', 'ph:hand-grabbing'] },
	more: { label: 'More actions', choices: ['ph:dots-three', 'ph:dots-three-vertical'] },
	history: { label: 'History', choices: ['ph:clock-counter-clockwise', 'ph:list-bullets'] },
	share: { label: 'Share', choices: ['ph:share-network', 'ph:qr-code'] },
	copy: { label: 'Copy', choices: ['ph:copy', 'ph:copy-simple'] },
	data: { label: 'Data', choices: ['ph:database', 'ph:hard-drives'] },
	pen: { label: 'Pen', choices: ['ph:pen-nib', 'ph:pencil-simple-line'] },
	eraser: { label: 'Eraser', choices: ['ph:eraser'] },
	/** Locks a scratch pad so a stray touch can't draw on it. */
	lock: { label: 'Lock', choices: ['ph:lock-simple', 'ph:lock'] },
	/** Hides what is written, e.g. a scratch pad's preview in the notes list. */
	hide: { label: 'Hide', choices: ['ph:eye-slash', 'ph:eye-closed'] },
	library: { label: 'Library', choices: ['ph:bookmarks-simple', 'ph:archive'] },
	folder: { label: 'Folder', choices: ['ph:folder', 'ph:folder-simple'] },
	tag: { label: 'Tag', choices: ['ph:tag', 'ph:tag-simple'] },
	fullScreen: { label: 'Full screen', choices: ['ph:arrows-out', 'ph:corners-out'] },
	showToPlayer: { label: 'Show to player', choices: ['ph:eye', 'ph:device-mobile'] }
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

/** Every base Iconify id offered by the catalogue, deduplicated and sorted. */
export function catalogueIconIds(): string[] {
	const ids = new Set<string>(TILE_SYMBOL_ICONS);
	for (const slot of iconSlots) for (const id of ICON_SLOTS[slot].choices) ids.add(id);
	return [...ids].sort();
}
