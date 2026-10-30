<script lang="ts" module>
	/** One row of Game info: a label and its value, which may open something. */
	export interface GameInfoRow {
		key: string;
		label: string;
		value?: string;
		/** Another site's page the value links to. */
		href?: string;
		/** A second line under the value. */
		extra?: string;
		/** Values tapped for their own details, comma separated (a mode, each special rule). */
		links?: { id: string; name: string; label: string; onclick: () => void }[];
		/** The value is tapped to open something; "None" when it has no value. */
		action?: () => void;
		actionTestId?: string;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { onLayerOpen } from '#lib/ui/primitives/layers.ts';
	import Popover from '#lib/ui/primitives/Popover.svelte';

	/**
	 * Game info (Trevor, 2026-10-19): the game's script, author, Storyteller and the rest, a row
	 * each, on the board corner's script name. The Storyteller's board (ModeMenu) and a player's
	 * grim (TownGameInfo) open the same sheet, each with its own rows.
	 */
	interface Props {
		rows: GameInfoRow[];
		/** The corner name, which opens it; without it, a dialog opened by `open` (the board's ⋯). */
		children?: Snippet;
		open?: boolean;
		/** A cell before each row's label (the Storyteller's eyes). */
		lead?: Snippet<[GameInfoRow]>;
		/** After each row's value, in its line (the script's download, the Storyteller's pencil). */
		after?: Snippet<[GameInfoRow]>;
		/** Buttons under the rows. */
		footer?: Snippet;
	}

	let { rows, children, open = $bindable(false), lead, after, footer }: Props = $props();
	let anchor = $state<HTMLElement>();
	const none = $derived(t('common.none'));

	// The corner's popover closes when a seat's sheet or another overlay opens over the board
	// (Trevor, 2026-10-19: "Game info popup should close if other item is opened like a
	// character"). The ⋯ dialog is an overlay itself, so it isn't closed this way.
	$effect(() => {
		if (open && children) return onLayerOpen(() => (open = false));
	});
</script>

{#if children}<button
		type="button"
		class="name"
		bind:this={anchor}
		aria-haspopup="dialog"
		aria-expanded={open}
		data-testid="mode-menu"
		onclick={() => (open = true)}>{@render children()}<Icon name="expand" /></button
	>{/if}
{#snippet sheet()}
	<table class="info" data-testid="game-info">
		<tbody>
			{#each rows as row (row.key)}
				<tr data-field={row.key}>
					{#if lead}<td class="eye-cell">{@render lead(row)}</td>{/if}
					<th scope="row">{row.label}</th>
					<td>
						{#if row.links?.length}<!-- Tapped for its full details (Trevor,
							2026-10-22: "allow clicking game mode or special rules in game info to see
							exact details"). -->{#each row.links as link, i (link.id)}{#if i > 0},
								{/if}<button
									type="button"
									class="inspect-link"
									aria-label={link.label}
									onclick={link.onclick}>{link.name}</button
								>{/each}{:else if row.action}<button
								type="button"
								class="inspect-link"
								data-testid={row.actionTestId}
								onclick={() => {
									open = false;
									row.action?.();
								}}>{row.value?.trim() || none}</button
							>{:else if row.href && row.value?.trim()}<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- another site's page -->
							<a href={row.href} target="_blank" rel="noopener noreferrer">{row.value}</a
							>{:else}{row.value?.trim() || none}{/if}{@render after?.(row)}{#if row.extra}<span
								class="extra"
								data-testid="info-extra">{row.extra}</span
							>{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<div class="actions">{@render footer?.()}</div>
{/snippet}
{#if children}
	<Popover bind:open title={t('modes.info.title')} {anchor}>{@render sheet()}</Popover>
{:else}
	<Dialog bind:open title={t('modes.info.title')}>{@render sheet()}</Dialog>
{/if}

<style>
	.extra {
		display: block;
	}
	/* The name keeps its size and place; only the caret is added, inside the same line. */
	.name {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.2em;
		min-width: 0;
		max-width: 100%;
		/* Text high, not a button's 44px: the corner's room is measured from its height
		   (corner-room.ts); the ::before below keeps the tap target. */
		min-height: 0;
		padding: 0;
		/* The corner title lets taps through to the board; its town name takes them. */
		pointer-events: auto;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: inherit;
		cursor: pointer;
		--icon-size: 0.9em;
	}
	/* The name is cut short as the corner title cuts it; the caret always shows. */
	.name > :global(:first-child) {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name > :global(:last-child) {
		flex: none;
	}
	/* A tap target bigger than the small corner text, without moving anything. */
	.name::before {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		min-width: max(100%, var(--tap-target));
		min-height: max(100%, var(--tap-target));
		transform: translate(-50%, -50%);
	}
	.info {
		border-collapse: collapse;
		margin-top: var(--space-2);
	}
	.eye-cell {
		padding-right: var(--space-2);
	}
	.info th {
		padding-right: var(--space-3);
		color: var(--on-surface-muted);
		font-weight: normal;
		text-align: left;
		white-space: nowrap;
	}
	.info th,
	.info td {
		padding-block: var(--space-1);
		vertical-align: top;
	}
	/* The mode, each rule, the join code and the Storyteller read as text and open something;
	   the tap target is widened without moving the row, as the corner name's is. */
	.inspect-link {
		position: relative;
		/* Inline in the row like the script's link; the ::before below is its tap target. */
		min-height: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--heading);
		font: inherit;
		text-align: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	.inspect-link::before {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		min-width: max(100%, var(--tap-target));
		min-height: max(100%, var(--tap-target));
		transform: translate(-50%, -50%);
	}
	.actions:empty {
		display: none;
	}
	.actions {
		display: grid;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}
	.actions :global(button),
	.actions :global(a) {
		justify-content: flex-start;
	}
</style>
