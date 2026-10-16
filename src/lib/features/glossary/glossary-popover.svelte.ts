import { tick } from 'svelte';
import type { GlossaryTerm } from '#lib/core/rules/glossary.ts';

/**
 * The one Glossary popover on the page (GlossaryPopover in the root layout). Terms are
 * plain buttons that point it at themselves, so a page of game text mounts no popovers.
 */
class GlossaryPopoverState {
	open = $state(false);
	term = $state<GlossaryTerm>();
	anchor = $state<HTMLElement>();
	/** Terms opened before this one from "see …" links, newest last, for Back. */
	history = $state<GlossaryTerm[]>([]);

	async show(term: GlossaryTerm, anchor: HTMLElement): Promise<void> {
		if (this.open && this.anchor === anchor) {
			this.open = false;
			return;
		}
		if (this.open) {
			// Close first, so the popover is positioned again at the new term.
			this.open = false;
			await tick();
		}
		this.term = term;
		this.anchor = anchor;
		this.history = [];
		this.open = true;
	}

	/** Follows a "see …" link to another entry in the same popover. */
	go(term: GlossaryTerm): void {
		if (this.term) this.history = [...this.history, this.term];
		this.term = term;
	}

	back(): void {
		const previous = this.history.at(-1);
		if (!previous) return;
		this.history = this.history.slice(0, -1);
		this.term = previous;
	}
}

export const glossaryPopover = new GlossaryPopoverState();
