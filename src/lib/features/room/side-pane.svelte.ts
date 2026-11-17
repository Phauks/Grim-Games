/**
 * The Storyteller's pane beside the board (plan M86; the grim as the home screen, Trevor
 * 2026-11-16: "make the grim the home screen"): the Day, the Night, Game notes and Players as
 * tabs. Where the screen is wide it is always shown, so the board never changes size; on a
 * phone it is a full-screen sheet, opened from its button by the grim cover.
 */
export type PaneTab = 'day' | 'night' | 'notes' | 'players';

class SidePane {
	/** The phone's sheet is open; beside the board the pane is always shown. */
	open = $state(false);
	tab = $state<PaneTab>('day');
	/** The pane is beside the board, so always shown (BoardPane sets it). */
	beside = $state(false);

	/** Whether the tab shows now: beside the board, or in the open sheet. */
	shows(tab: PaneTab): boolean {
		return this.tab === tab && (this.beside || this.open);
	}

	show(tab: PaneTab): void {
		this.tab = tab;
		this.open = true;
	}

	/** Back to the board: the phone's sheet closes; beside the board nothing changes. */
	hide(): void {
		this.open = false;
	}
}

export const sidePane = new SidePane();
