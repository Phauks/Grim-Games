<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * The reminder bin pulled up (Trevor, 2026-10-29: "a way to see more tokens without
	 * scrolling"): every token at once, in rows under its stretch's caption, over the lower part
	 * of the town. The Storyteller's bank pulls up into it; a player's Grim tab opens it from its
	 * reminder button. Not a dialog, so a token can be dragged out of it: while one is dragged the
	 * sheet drops away (`lowered`), still there, and comes back when it is put down. A tap
	 * outside it, Escape or its handle closes it.
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
		/** What opens it, whose own tap isn't a tap outside. */
		opener?: HTMLElement;
	}

	let {
		open = $bindable(),
		label,
		groups,
		keyOf,
		item,
		lowered = false,
		header,
		opener
	}: Props = $props();

	let sheet = $state<HTMLElement>();

	function outside(event: PointerEvent) {
		if (!open || lowered) return;
		const target = event.target as Node | null;
		if (!target || sheet?.contains(target) || opener?.contains(target)) return;
		// A dialog opened from the sheet (choosing a seat) isn't outside it.
		if ((target as Element).closest?.('[role="dialog"], [role="alertdialog"]')) return;
		open = false;
	}
	const empty = $derived(groups.every((g) => g.items.length === 0));
</script>

<svelte:window
	onpointerdown={outside}
	onkeydown={(event) => {
		if (open && event.key === 'Escape') open = false;
	}}
/>

{#if open}
	<section
		class="bin"
		class:lowered
		bind:this={sheet}
		aria-label={label}
		data-testid="reminder-bin"
	>
		<button
			type="button"
			class="handle"
			aria-label="Close {label}"
			aria-expanded="true"
			onclick={() => (open = false)}><Icon name="expand" /></button
		>
		{@render header?.()}
		<div class="groups">
			{#each groups as group (group.key)}
				{#if group.items.length > 0}
					<div class="group" data-group={group.key}>
						{#if group.caption}<span class="caption">{group.caption}</span>{/if}
						<ul aria-label={group.caption ?? label}>
							{#each group.items as token (keyOf(token))}
								<li>{@render item(token)}</li>
							{/each}
						</ul>
					</div>
				{/if}
			{/each}
			{#if empty}<p class="none">None</p>{/if}
		</div>
	</section>
{/if}

<style>
	.bin {
		position: absolute;
		left: 0;
		right: 0;
		bottom: var(--bin-bottom, 0);
		z-index: 3;
		display: flex;
		flex-direction: column;
		max-height: var(--bin-height, 60%);
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
		align-self: center;
		display: grid;
		place-items: center;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		cursor: pointer;
	}
	.groups {
		display: grid;
		gap: var(--space-2);
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.group {
		display: grid;
		gap: var(--space-1);
	}
	/* The bank's caption pill (ReminderBank .caption), at the start of its rows. */
	.caption {
		justify-self: start;
		padding: 0 var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		color: var(--on-surface-muted);
		font: 600 0.65rem / 1.6 var(--font-control);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		position: relative;
		display: grid;
		place-items: center;
		/* Room for the name band, which is wider than the token, and the label under it. */
		padding-inline: 0.75rem;
		padding-bottom: calc(0.375 * var(--u));
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
