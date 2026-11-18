/**
 * The Storyteller's pane beside the board (plan M86; the grim as the home screen, Trevor
 * 2026-11-16: "make the grim the home screen"). Where the screen is wide it is always shown, so
 * the board never changes size; on a phone it is a full-screen sheet, opened from its button by
 * the grim cover.
 *
 * Three subjects, each with its own views (Trevor, 2026-11-18: "i like nav with sub-nav"; "only
 * game, players, and more"): the pane is also where the board's ⋯ menu went, so History,
 * the Soundboard and the session's start and end are views of More.
 */
export const PANE_VIEWS = {
	game: ['day', 'night', 'bluffs'],
	players: ['players', 'notes'],
	more: ['seats', 'sounds', 'history', 'session']
} as const;

export type PaneSubject = keyof typeof PANE_VIEWS;
export type PaneView = (typeof PANE_VIEWS)[PaneSubject][number];

/** The subject a view belongs to. */
export function subjectOf(view: PaneView): PaneSubject {
	for (const subject of Object.keys(PANE_VIEWS) as PaneSubject[])
		if ((PANE_VIEWS[subject] as readonly PaneView[]).includes(view)) return subject;
	return 'game';
}

class SidePane {
	/** The phone's sheet is open; beside the board the pane is always shown. */
	open = $state(false);
	subject = $state<PaneSubject>('game');
	/** Each subject keeps the view last chosen in it. */
	views = $state<{ [S in PaneSubject]: PaneView }>({
		game: 'day',
		players: 'players',
		more: 'seats'
	});
	/** The pane is beside the board, so always shown (BoardPane sets it). */
	beside = $state(false);

	/** The view now chosen, in the chosen subject. */
	get view(): PaneView {
		return this.views[this.subject];
	}

	/** Turns to a view without opening a phone's sheet. */
	turnTo(view: PaneView): void {
		const subject = subjectOf(view);
		this.views[subject] = view;
		this.subject = subject;
	}

	/** Whether the view shows now: beside the board, or in the open sheet. */
	shows(view: PaneView): boolean {
		return this.view === view && (this.beside || this.open);
	}

	show(view: PaneView): void {
		this.turnTo(view);
		this.open = true;
	}

	/** Back to the board: the phone's sheet closes; beside the board nothing changes. */
	hide(): void {
		this.open = false;
	}
}

export const sidePane = new SidePane();
