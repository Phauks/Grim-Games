<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		BASE_DISTRIBUTION,
		MAX_DEALT_PLAYERS,
		SEATED_TYPES,
		splitPlayers
	} from '#lib/core/rules/index.ts';
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
	}

	let { players, onPick, maxPlayers }: Props = $props();
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
<table class="setup-table" data-testid="setup-table">
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
	/* Each type's name in its tokens' blue or red, whatever the theme (Trevor, 2026-10-29). */
	tbody tr[data-type='townsfolk'] th,
	tbody tr[data-type='outsider'] th {
		color: var(--good);
	}
	tbody tr[data-type='minion'] th,
	tbody tr[data-type='demon'] th {
		color: var(--evil);
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
	/* The chosen total in gold; its counts below stay red (Trevor, 2026-10-18). */
	thead [data-current] {
		background: var(--count-current);
		color: var(--on-count-current);
	}
</style>
