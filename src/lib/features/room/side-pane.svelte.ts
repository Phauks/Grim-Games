/**
 * The Storyteller's pane of Game notes and Players (plan M86, Trevor 2026-11-15): beside the
 * board where the screen has room, a full-screen sheet on a phone. Its button sits beside the
 * grim cover; ⋯'s Players and a seat's note mark open it too.
 */
export type PaneTab = 'notes' | 'players';

class SidePane {
	open = $state(false);
	tab = $state<PaneTab>('notes');

	show(tab: PaneTab): void {
		this.tab = tab;
		this.open = true;
	}

	toggle(): void {
		this.open = !this.open;
	}
}

export const sidePane = new SidePane();
