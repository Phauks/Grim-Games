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
	players: { label: 'Players', choices: ['ph:users-three', 'ph:users'] },
	script: { label: 'Script', choices: ['ph:scroll', 'ph:book-open'] },
	notes: { label: 'Notes', choices: ['ph:note-pencil', 'ph:notepad', 'ph:feather'] },
	undo: { label: 'Undo', choices: ['ph:arrow-counter-clockwise', 'ph:arrow-u-up-left'] },
	redo: { label: 'Redo', choices: ['ph:arrow-clockwise', 'ph:arrow-u-up-right'] },
	reset: {
		label: 'Reset to default',
		choices: ['ph:arrow-counter-clockwise']
	},
	add: { label: 'Add', choices: ['ph:plus', 'ph:plus-circle'] },
	minus: { label: 'Minus', choices: ['ph:minus', 'ph:minus-circle'] },
	resume: { label: 'Resume game', choices: ['ph:play-circle', 'ph:play'] },
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
	diagnostics: { label: 'Diagnostics', choices: ['ph:stethoscope', 'ph:pulse'] },
	back: { label: 'Back', choices: ['ph:arrow-left', 'ph:caret-left'] },
	forward: { label: 'Forward', choices: ['ph:caret-right', 'ph:arrow-right'] },
	check: { label: 'Selected', choices: ['ph:check'] },
	random: { label: 'Random selection', choices: ['ph:shuffle', 'ph:dice-five'] },
	clearSelection: { label: 'Clear selection', choices: ['ph:eraser', 'ph:x-circle'] },
	expand: { label: 'Show or hide a section', choices: ['ph:caret-down', 'ph:caret-circle-down'] },
	wiki: { label: 'Wiki link', choices: ['ph:arrow-square-out', 'ph:book-open-text'] },
	search: { label: 'Search', choices: ['ph:magnifying-glass'] },
	report: { label: 'Report a problem', choices: ['ph:bug', 'ph:flag'] },
	reference: { label: 'Character reference', choices: ['ph:books', 'ph:book-bookmark'] },
	glossary: { label: 'Glossary', choices: ['ph:book-open-text', 'ph:list-magnifying-glass'] },
	warning: { label: 'Warning', choices: ['ph:warning', 'ph:warning-circle'] },
	sort: { label: 'Sort', choices: ['ph:arrows-down-up'] },
	sortAscending: { label: 'Sorted ascending', choices: ['ph:caret-up', 'ph:sort-ascending'] },
	sortDescending: { label: 'Sorted descending', choices: ['ph:caret-down', 'ph:sort-descending'] },
	filter: { label: 'Filter', choices: ['ph:funnel'] },
	assistance: { label: 'Storyteller settings', choices: ['ph:lifebuoy', 'ph:hand-heart'] },
	remove: { label: 'Remove', choices: ['ph:trash', 'ph:trash-simple'] },
	save: { label: 'Save', choices: ['ph:bookmark-simple', 'ph:floppy-disk'] },
	swap: { label: 'Swap seats', choices: ['ph:arrows-left-right', 'ph:swap'] },
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

/** Every base Iconify id offered by the catalogue, deduplicated and sorted. */
export function catalogueIconIds(): string[] {
	const ids = new Set<string>();
	for (const slot of iconSlots) for (const id of ICON_SLOTS[slot].choices) ids.add(id);
	return [...ids].sort();
}
