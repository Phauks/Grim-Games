<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	/**
	 * Every reminder token at once (Trevor, 2026-10-29: "a way to see more tokens without
	 * scrolling"), in rows under its stretch's caption: the reminder tray pulled up
	 * (ReminderTray), the Storyteller's bank and a player's alike.
	 */
	interface Props {
		/** Names the rows of a stretch with no caption. */
		label: string;
		groups: readonly { key: string; caption?: string; items: readonly T[] }[];
		keyOf: (item: T) => string;
		item: Snippet<[T]>;
		/** The tokens' diameter in px, which sets how far their name bands reach past them. */
		size: number;
	}

	let { label, groups, keyOf, item, size }: Props = $props();

	const empty = $derived(groups.every((g) => g.items.length === 0));

	/**
	 * Each cell as wide as its own token's name band, not the widest band the Reminder words
	 * setting allows (Trevor, 2026-10-31: only two tokens a row on his Pixel), so short words
	 * pack tight and long ones still aren't cut off.
	 */
	function fitBand(cell: HTMLElement) {
		const band = () => {
			const label = cell.querySelector<HTMLElement>('.label');
			cell.style.setProperty('--band', label ? `${label.offsetWidth}px` : '0px'); // px-ok: measured
		};
		const observer = new ResizeObserver(band);
		observer.observe(cell);
		const label = cell.querySelector('.label');
		if (label) observer.observe(label);
		band();
		return () => observer.disconnect();
	}
</script>

<div class="groups" data-testid="reminder-groups" style:--d="{size}px">
	{#each groups as group (group.key)}
		{#if group.items.length > 0}
			<div class="group" data-group={group.key}>
				{#if group.caption}<span class="caption">{group.caption}</span>{/if}
				<ul aria-label={group.caption ?? label}>
					{#each group.items as token (keyOf(token))}
						<li {@attach fitBand}>{@render item(token)}</li>
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
		/* Room for this token's own name band past its sides (`fitBand`), so the first column's
		   isn't cut off (Trevor, 2026-10-31: the Scarlet Woman's "Is the Demon"). */
		padding-inline: max(0.25rem, calc((var(--band, var(--d)) - var(--d)) / 2 + 0.1rem));
		padding-bottom: calc(0.375 * var(--u));
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
