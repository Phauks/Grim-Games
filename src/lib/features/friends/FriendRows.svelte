<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import ProfileIcon from '#lib/features/account/ProfileIcon.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';

	/**
	 * A list of rows about accounts (plan F1, F9, F10): the Friends page's lists, Send to a
	 * friend and a profile's scripts. Each row is an account's profile icon (when it has one),
	 * its text and its actions at the end; an empty list says "None" (Trevor's UI rules).
	 */
	interface Props {
		items: readonly T[];
		key: (item: T) => string | number;
		testid: string;
		/** The account whose profile icon leads the row; none for a row with no icon. */
		icon?: (item: T) => string | null;
		label: Snippet<[T]>;
		actions?: Snippet<[T]>;
	}

	let { items, key, testid, icon, label, actions }: Props = $props();
</script>

{#if items.length === 0}
	<p class="muted" data-testid="{testid}-none">{t('common.none')}</p>
{:else}
	<ul class="rows" data-testid={testid}>
		{#each items as item (key(item))}
			<li>
				{#if icon}<span class="icon"><ProfileIcon icon={icon(item)} /></span>{/if}
				<span class="label">{@render label(item)}</span>
				{#if actions}<span class="actions">{@render actions(item)}</span>{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers, not cards (Trevor's UI rules). */
	.rows li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--tap-target);
		padding-block: var(--space-2);
		border-bottom: var(--card-border);
	}
	.rows li:last-child {
		border-bottom: 0;
	}
	.icon {
		display: grid;
		flex: none;
		width: calc(2.5 * var(--icon-size));
		height: calc(2.5 * var(--icon-size));
	}
	.label {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
		font-weight: var(--font-control-weight);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
