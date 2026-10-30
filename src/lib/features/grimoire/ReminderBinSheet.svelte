<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import SheetHandle from '#lib/ui/primitives/SheetHandle.svelte';
	import ReminderGroups from './ReminderGroups.svelte';
	import { escapeCloses, pressedOutside } from './bin-dismiss.ts';

	/**
	 * A player's reminder bin (Trevor, 2026-10-29), opened from the Grim tab's reminder button:
	 * every token at once (ReminderGroups) over the lower part of the town. Not a dialog, so a
	 * token can be dragged out of it: while one is dragged the sheet drops away (`lowered`),
	 * still there, and comes back when it is put down. A tap outside it, Escape, or its handle
	 * bar (tapped or pulled down) closes it.
	 */
	interface Props {
		open: boolean;
		/** Its accessible name. */
		label: string;
		groups: readonly { key: string; caption?: string; items: readonly T[] }[];
		keyOf: (item: T) => string;
		item: Snippet<[T]>;
		/** A token is being dragged out: the sheet drops away. */
		lowered?: boolean;
		/** Above the tokens, such as a search field. */
		header?: Snippet;
	}

	let { open = $bindable(), label, groups, keyOf, item, lowered = false, header }: Props = $props();

	let sheet = $state<HTMLElement>();
	/** Pulled down by its handle bar, in px. */
	let pull = $state(0);
</script>

<svelte:window
	onpointerdown={(event) => {
		if (open && !lowered && pressedOutside(event, sheet)) open = false;
	}}
	onkeydown={(event) => {
		if (open && escapeCloses(event)) open = false;
	}}
/>

{#if open}
	<section
		class="bin"
		class:lowered
		bind:this={sheet}
		aria-label={label}
		data-testid="reminder-bin"
		style:translate={pull ? `0 ${pull}px` : undefined}
	>
		<div class="handle">
			<SheetHandle
				label="Close {label}"
				expanded
				onToggle={() => (open = false)}
				onPull={(up, end) => {
					pull = Math.max(0, -up);
					if (!end) return;
					pull = 0;
					// Pulled down past a third of a tap target closes it.
					if (up < -16) open = false;
				}}
			/>
		</div>
		{@render header?.()}
		<ReminderGroups {label} {groups} {keyOf} {item} />
	</section>
{/if}

<style>
	.bin {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 3;
		display: flex;
		flex-direction: column;
		max-height: 60%;
		box-sizing: border-box;
		padding: 0 var(--space-2) var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		box-shadow: var(--shadow);
		transition:
			translate var(--duration-fast) ease,
			opacity var(--duration-fast) ease;
	}
	/* A token is on its way out: out of the way, still there to come back to. */
	.bin.lowered {
		translate: 0 100%;
		opacity: 0;
	}
	.handle {
		display: grid;
		justify-items: center;
	}
</style>
