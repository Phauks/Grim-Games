<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BesidePlacement } from './beside.ts';

	/**
	 * Something shown beside a screen's content while it is on (plan E3: the player screen's
	 * Notes beside its tabs; M86: the Storyteller's Game notes and Players beside the board,
	 * Trevor 2026-11-15: "I really like seeing the notes right next to the game grim"). `side`
	 * is a column on the right with a hairline, `under` splits `room` between the content (the
	 * top three fifths, given to it as `--panel-room`) and the pane. Each scrolls on its own.
	 * The content stays where it is as the pane comes and goes, so it keeps its scroll.
	 */
	interface Props {
		/** Where the pane goes; none shows the content alone. */
		placement: BesidePlacement | undefined;
		/** The pane's name, read out for its landmark. */
		label: string;
		/** The height the two share (a CSS length); the screen's by default. */
		room?: string;
		/** The pane's own contents; leave out while it is off. */
		pane?: Snippet;
		/**
		 * The pane on its own panel colour up to its edge, as a sheet's, rather than over the
		 * screen's background (the board's pane, Trevor 2026-11-16).
		 */
		solid?: boolean;
		children: Snippet;
	}

	let { placement, label, room, pane, solid = false, children }: Props = $props();
	const on = $derived(placement && pane ? placement : undefined);

	let aside = $state<HTMLElement>();
	/** As the keyboard opens and the pane shrinks above it, the field being typed in stays shown. */
	$effect(() => {
		const viewport = window.visualViewport;
		if (!viewport || !aside) return;
		const box = aside;
		const keep = () => {
			const focused = document.activeElement;
			if (focused instanceof HTMLElement && box.contains(focused))
				requestAnimationFrame(() => focused.scrollIntoView({ block: 'nearest' }));
		};
		viewport.addEventListener('resize', keep);
		return () => viewport.removeEventListener('resize', keep);
	});
</script>

<div class="beside" data-beside={on} data-solid={solid || undefined} style:--beside-room={room}>
	<div class="main">{@render children()}</div>
	{#if on && pane}
		<aside class="pane" aria-label={label} data-testid="beside-pane" bind:this={aside}>
			{@render pane()}
		</aside>
	{/if}
</div>

<style>
	.beside {
		--room: var(--beside-room, 100dvh);
	}
	/* The content's own width, for what sizes to it rather than the screen (the board's bar). */
	.beside > .main {
		container: beside / inline-size;
	}
	.beside[data-beside] {
		display: grid;
		gap: var(--space-4);
	}
	.beside[data-beside='side'] {
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 30%);
		align-items: start;
	}
	.pane {
		/* Headings pin to the top of the pane, which scrolls itself. */
		--pin-top: 0rem;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	/* With the on-screen keyboard up (keyboard-inset.ts), the pane ends above it and starts at
	   the top of what is shown, so a note being typed in it stays in view (Trevor, 2026-11-16). */
	.beside[data-beside='side'] > .pane {
		position: sticky;
		top: var(--keyboard-top, 0rem);
		height: calc(var(--room) - var(--keyboard-inset, 0rem) - var(--keyboard-top, 0rem));
		padding-inline-start: var(--space-3);
		border-inline-start: 1px solid var(--border); /* px-ok: a hairline, as the bar's */
	}
	/* Under, the pane keeps its two fifths and the content above gives up what the keyboard
	   covers, so the pane sits just above the keyboard. */
	.beside[data-beside='under'] {
		--kept: calc(var(--keyboard-inset, 0rem) + var(--keyboard-top, 0rem));
		gap: 0;
		height: calc(var(--room) - var(--kept));
		grid-template-rows: minmax(0, 1fr) calc(0.4 * var(--room));
	}
	.beside[data-beside='under'] > .main {
		--panel-room: max(0rem, calc(0.6 * var(--room) - var(--space-2) - var(--kept)));
		--pin-top: 0rem;
		min-height: 0;
		overflow-y: auto;
	}
	/* Typing in the content instead (the bank's search): the pane gives up what the keyboard
	   covers, so the content keeps its room above the keyboard. */
	.beside[data-beside='under']:has(> .main:focus-within) {
		grid-template-rows: minmax(0, 1fr) max(0rem, calc(0.4 * var(--room) - var(--kept)));
	}
	.beside[data-beside='under']:has(> .main:focus-within) > .main {
		--panel-room: max(0rem, calc(0.6 * var(--room) - var(--space-2)));
	}
	.beside[data-solid] > .pane {
		background: var(--dialog-background, var(--surface));
	}
	.beside[data-beside='under'] > .pane {
		border-top: 1px solid var(--border); /* px-ok: a hairline, as the bar's */
	}
</style>
