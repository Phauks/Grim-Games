<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		BASE_DISTRIBUTION,
		MAX_DEALT_PLAYERS,
		splitPlayers
	} from '#lib/core/rules/setup/distribution.ts';
	import { SEATED_TYPES } from '#lib/core/data/types.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';

	interface Props {
		/**
		 * Everyone at the table, Travellers included; the dealt players' column is highlighted.
		 * None highlighted when unknown (a printed script sheet).
		 */
		players?: number;
		/** Tapping anywhere in a column picks its count (Trevor, 2026-10-16 and 2026-10-17). */
		onPick?: (players: number) => void;
		/**
		 * The most players the script is made for (Teensyville: 6). Larger counts are greyed
		 * out but stay pickable (Trevor, 2026-10-19).
		 */
		maxPlayers?: number;
		/**
		 * The printed sheet's look: each player count a column under its own tab, good rows
		 * tinted blue and evil rows red, in ink a printer keeps (Trevor, 2026-11-16).
		 */
		printed?: boolean;
	}

	let { players, onPick, maxPlayers, printed = false }: Props = $props();
	const tooMany = (n: number) => maxPlayers !== undefined && n > maxPlayers;

	const columns = Object.keys(BASE_DISTRIBUTION).map(Number);
	// Beyond 15 the extra players are Travellers, so the 15 column still applies.
	const current = $derived(
		players === undefined ? undefined : Math.min(splitPlayers(players).dealt, MAX_DEALT_PLAYERS)
	);
</script>

<!--
	The setup sheet's counts for 5 to 15 players, laid out like the printed sheet (players
	across, character types down), and the one player count table everywhere: setup, New game
	and the script sheet (Trevor, 2026-10-17; https://wiki.bloodontheclocktower.com/Setup).
	Fixed size whatever the count.
-->
<table class="setup-table" class:printed data-testid="setup-table">
	<thead>
		<tr>
			<th scope="row">{t('setup.players')}</th>
			{#each columns as n (n)}
				<th
					scope="col"
					data-current={n === current ? '' : undefined}
					data-too-many={tooMany(n) ? '' : undefined}
					title={tooMany(n) ? t('setup.tooManyPlayers') : undefined}
				>
					{#if onPick}
						<button
							type="button"
							aria-label={tooMany(n)
								? `${t('common.players', { count: n })}, ${t('setup.tooManyPlayers')}`
								: t('common.players', { count: n })}
							aria-pressed={n === current}
							onclick={() => onPick(n)}>{n === MAX_DEALT_PLAYERS ? `${n}+` : n}</button
						>
					{:else}{n === MAX_DEALT_PLAYERS ? `${n}+` : n}{/if}
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each SEATED_TYPES as type (type)}
			<tr data-type={type}>
				<th scope="row">{TYPE_PLURALS[type]}</th>
				{#each columns as n (n)}
					<!-- The whole column is the tap target; the header's button serves the keyboard. -->
					<td
						data-current={n === current ? '' : undefined}
						data-pick={onPick ? '' : undefined}
						data-too-many={tooMany(n) ? '' : undefined}
						onclick={() => onPick?.(n)}
					>
						{BASE_DISTRIBUTION[n][type]}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.setup-table {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		font-size: 0.78rem;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
	th,
	td {
		padding: 1px 0;
	}
	th[scope='row'] {
		width: 6.5em;
		padding-inline-end: var(--space-1);
		overflow: hidden;
		text-align: start;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	thead th {
		font-weight: 600;
	}
	/* Lines between the player counts, and under the counts row (Trevor, 2026-10-18). */
	thead th {
		border-bottom: 1px solid var(--border);
	}
	th[scope='col'],
	td {
		border-inline-start: 1px solid var(--border);
	}
	/* Each type's name in its tokens' blue or red, whatever the theme (Trevor, 2026-10-29), as
	   text: the fills are about 2:1 on a dark surface, the text tints about 10:1. */
	tbody tr[data-type='townsfolk'] th,
	tbody tr[data-type='outsider'] th {
		color: var(--good-text);
	}
	tbody tr[data-type='minion'] th,
	tbody tr[data-type='demon'] th {
		color: var(--evil-text);
	}
	button {
		width: 100%;
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	[data-pick] {
		cursor: pointer;
	}
	[data-current] {
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 700;
	}
	/* More players than the script is made for: greyed, still pickable. */
	[data-too-many]:not([data-current]) {
		color: var(--on-surface-muted);
		opacity: 0.45;
	}
	/* Printed: a column per player count under an accent tab, outlined in ink (Trevor,
	   2026-11-16). The type names and counts take the teams' own colours, dark on paper. */
	.setup-table.printed {
		border-collapse: separate;
		border-spacing: 0.2em 0;
		font-size: 0.85rem;
	}
	.printed th,
	.printed td {
		padding: 0.1em 0;
		border: 0;
	}
	.printed th[scope='col'],
	.printed td {
		border-inline: 0.1em solid var(--print-ink);
		font-weight: 700;
	}
	.printed th[scope='col'] {
		border-top: 0.1em solid var(--print-ink);
		border-radius: 0.5em 0.5em 0 0;
		background: var(--accent);
		color: var(--on-accent);
		font-family: var(--font-heading);
		font-size: 1.1em;
	}
	.printed thead th[scope='row'] {
		font-weight: 400;
	}
	.printed tbody tr:last-child td {
		border-bottom: 0.1em solid var(--print-ink);
		border-radius: 0 0 0.5em 0.5em;
	}
	.printed tbody tr[data-type='townsfolk'] > *,
	.printed tbody tr[data-type='outsider'] > * {
		color: var(--good);
	}
	.printed tbody tr[data-type='minion'] > *,
	.printed tbody tr[data-type='demon'] > * {
		color: var(--evil);
	}
	.printed tbody tr[data-type='townsfolk'] td,
	.printed tbody tr[data-type='outsider'] td {
		background: var(--print-good-tint);
	}
	.printed tbody tr[data-type='minion'] td,
	.printed tbody tr[data-type='demon'] td {
		background: var(--print-evil-tint);
	}
	/* The chosen total in gold; its counts below stay red (Trevor, 2026-10-18). */
	thead [data-current] {
		background: var(--count-current);
		color: var(--on-count-current);
	}
</style>
