<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * The reminder bank's run button, at its right end (Trevor, 2026-10-18): the game's next
	 * phase (Set up, Start game, End night, End day, or Run night to pick a stopped
	 * walk-through up). Always there, so the bank never moves. `hint`: a count; each rise
	 * lights it up for a moment.
	 */
	interface Props {
		run: {
			/** Its accessible name, and the shorter words shown. */
			label: string;
			text: string;
			icon: 'bag' | 'day' | 'night';
			disabled: boolean;
			onclick: () => void;
			hint?: number;
		};
	}

	let { run }: Props = $props();

	// ── End night lights up when Next is tapped past the last step ──
	let hinting = $state(false);
	$effect(() => {
		if (!run?.hint) return;
		// Off for a frame first, so a second tap starts the pulse again.
		hinting = false;
		let off: ReturnType<typeof setTimeout> | undefined;
		const on = requestAnimationFrame(() => {
			hinting = true;
			off = setTimeout(() => (hinting = false), 2000);
		});
		return () => {
			cancelAnimationFrame(on);
			clearTimeout(off);
		};
	});
</script>

<!-- Rounded on the right like the box. -->
<button
	type="button"
	class="run"
	aria-label={run.label}
	data-hint={hinting ? '' : undefined}
	disabled={run.disabled}
	onclick={run.onclick}
>
	<Icon name={run.icon} />
	<span>{run.text}</span>
</button>

<style>
	.run {
		flex: none;
		align-self: stretch;
		display: grid;
		place-items: center;
		align-content: center;
		gap: var(--space-1);
		width: 5.5rem;
		padding: 0 var(--space-1);
		border: 0;
		border-inline-start: 1px solid var(--border);
		border-start-end-radius: calc(var(--radius-md) - 1px);
		border-end-end-radius: calc(var(--radius-md) - 1px);
		background: var(--accent);
		/* The buttons' edge, so it never blends into the bank (Trevor, 2026-10-22). */
		box-shadow: inset 0 0 0 1px var(--accent-edge);
		color: var(--on-accent);
		font: 600 0.8rem var(--font-control);
		cursor: pointer;
	}
	.run :global(svg) {
		width: 1.6em;
		height: 1.6em;
	}
	/* Next past the last step points here (Trevor, 2026-10-19): a ring that pulses, or just
	   shows under reduced motion (the duration tokens are 0ms then). An inset ring on the
	   cell's own edge, so it follows its rounded corners (Trevor, 2026-10-20: it sat in from
	   the edges). */
	.run[data-hint] {
		box-shadow: inset 0 0 0 0.2rem var(--on-accent);
		animation: end-hint var(--duration-slow) ease-in-out 4 alternate;
	}
	@keyframes end-hint {
		to {
			box-shadow: inset 0 0 0 0.2rem transparent;
		}
	}
	.run:disabled {
		background: none;
		color: var(--on-surface-muted);
		cursor: default;
	}
</style>
