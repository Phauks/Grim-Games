<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	/**
	 * Every reminder token at once (Trevor, 2026-10-29: "a way to see more tokens without
	 * scrolling"), in rows under its stretch's caption: the Storyteller's bank pulled up
	 * (ReminderBank) and a player's reminder bin (ReminderBinSheet).
	 */
	interface Props {
		/** Names the rows of a stretch with no caption. */
		label: string;
		groups: readonly { key: string; caption?: string; items: readonly T[] }[];
		keyOf: (item: T) => string;
		item: Snippet<[T]>;
	}

	let { label, groups, keyOf, item }: Props = $props();

	const empty = $derived(groups.every((g) => g.items.length === 0));
</script>

<div class="groups" data-testid="reminder-groups">
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

<style>
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
