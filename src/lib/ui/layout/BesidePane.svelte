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
		/**
		 * Beside, the content scrolls in its own column too, in the room given, so the screen or
		 * dialog round it doesn't scroll as well (Trevor, 2026-11-18: notes stopped short and
		 * "we have two scrollbars"): one scroll bar for each column, each reaching the bottom.
		 */
		ownScroll?: boolean;
		children: Snippet;
	}

	let {
		placement,
		label,
		room,
		pane,
		solid = false,
		ownScroll = false,
		children
	}: Props = $props();
	const on = $derived(placement && pane ? placement : undefined);

	let aside = $state<HTMLElement>();
	/**
	 * What the pane takes from the screen's right and bottom, so a background fixed to the screen
	 * behind the content stops at the content's edge and is centred on it rather than on the
	 * whole screen (Trevor, 2026-11-17: "the background is not centered on the actual part on
	 * the grim"). `--beside-end` and `--beside-bottom`, for whatever is fixed inside the content.
	 */
	let taken = $state({ end: 0, bottom: 0 });
	$effect(() => {
		const box = aside;
		if (!box || !on) {
			taken = { end: 0, bottom: 0 };
			return;
		}
		const measure = () => {
			const rect = box.getBoundingClientRect();
			// Up to the pane's edge, so the gap between the two is the content's too.
			taken = {
				end: on === 'side' ? Math.max(0, window.innerWidth - rect.left) : 0,
				bottom: on === 'under' ? Math.max(0, window.innerHeight - rect.top) : 0
			};
		};
		measure();
		const resized = new ResizeObserver(measure);
		resized.observe(box);
		window.addEventListener('resize', measure, { passive: true });
		return () => {
			resized.disconnect();
			window.removeEventListener('resize', measure);
		};
	});
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

<div
	class="beside"
	data-beside={on}
	data-solid={solid || undefined}
	data-own-scroll={(on && ownScroll) || undefined}
	style:--beside-room={room}
	style:--beside-end={taken.end ? `${taken.end}px` : undefined}
	style:--beside-bottom={taken.bottom ? `${taken.bottom}px` : undefined}
>
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
	/* Each column scrolls itself in the room given, the pane beside the content to its foot.
	   The content's scroll box reaches out by the sheets' bleed (PlayerScriptTabs), with that
	   room given back inside, so nothing is clipped or scrolls sideways. */
	.beside[data-beside='side'][data-own-scroll] {
		--kept: calc(var(--keyboard-inset, 0rem) + var(--keyboard-top, 0rem));
		height: calc(var(--room) - var(--kept));
		grid-template-rows: minmax(0, 1fr);
		align-items: stretch;
	}
	.beside[data-beside='side'][data-own-scroll] > .main {
		--panel-room: calc(var(--room) - var(--kept));
	}
	.beside[data-own-scroll] > .main {
		--pin-top: 0rem;
		min-height: 0;
		margin-inline: calc(-1 * var(--space-3));
		padding-inline: var(--space-3);
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.beside[data-beside='side'][data-own-scroll] > .pane {
		position: static;
		height: auto;
	}
	/* A solid pane fills a pinned header with its own colour, not the page's backdrop, which
	   showed as a dark box round a pill once the pane scrolled (Trevor, 2026-11-19). */
	.beside[data-solid] > .pane {
		--pin-background: var(--dialog-background, var(--surface));
		background: var(--dialog-background, var(--surface));
	}
	.beside[data-beside='under'] > .pane {
		border-top: 1px solid var(--border); /* px-ok: a hairline, as the bar's */
	}
</style>
