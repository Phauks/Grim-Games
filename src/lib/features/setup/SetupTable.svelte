<script lang="ts">
	import {
		BASE_DISTRIBUTION,
		MAX_DEALT_PLAYERS,
		SEATED_TYPES,
		splitPlayers
	} from '#lib/core/rules/index.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';

	interface Props {
		/** Everyone at the table, Travellers included; the dealt players' column is highlighted. */
		players: number;
	}

	let { players }: Props = $props();

	const columns = Object.keys(BASE_DISTRIBUTION).map(Number);
	// Beyond 15 the extra players are Travellers, so the 15 column still applies.
	const current = $derived(Math.min(splitPlayers(players).dealt, MAX_DEALT_PLAYERS));
</script>

<!--
	The setup sheet's counts for 5 to 15 players, laid out like the printed sheet (players
	across, character types down), always shown wherever the player count is set
	(https://wiki.bloodontheclocktower.com/Setup). Fixed size whatever the count.
-->
<table class="setup-table" data-testid="setup-table">
	<thead>
		<tr>
			<th scope="row">Players</th>
			{#each columns as n (n)}
				<th scope="col" data-current={n === current ? '' : undefined}
					>{n === MAX_DEALT_PLAYERS ? `${n}+` : n}</th
				>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each SEATED_TYPES as type (type)}
			<tr data-type={type}>
				<th scope="row">{TYPE_PLURALS[type]}</th>
				{#each columns as n (n)}
					<td data-current={n === current ? '' : undefined}>{BASE_DISTRIBUTION[n][type]}</td>
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
	tbody tr[data-type='townsfolk'] th,
	tbody tr[data-type='outsider'] th {
		color: var(--good);
	}
	tbody tr[data-type='minion'] th,
	tbody tr[data-type='demon'] th {
		color: var(--evil);
	}
	[data-current] {
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 700;
	}
</style>
