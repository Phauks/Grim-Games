<script lang="ts">
	import { BASE_DISTRIBUTION, SEATED_TYPES } from '#lib/core/rules/index.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open: boolean;
		/** Players dealt a character; that row is highlighted. */
		dealt: number;
	}

	let { open = $bindable(), dealt }: Props = $props();
	const rows = Object.entries(BASE_DISTRIBUTION).map(([n, counts]) => ({ n: Number(n), counts }));
</script>

<!-- The setup sheet's counts for 5 to 15 players (https://wiki.bloodontheclocktower.com/Setup). -->
<Dialog bind:open title="Setup sheet">
	<table>
		<thead>
			<tr>
				<th scope="col">Players</th>
				{#each SEATED_TYPES as type (type)}<th scope="col">{TYPE_PLURALS[type]}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.n)}
				<tr aria-current={row.n === dealt ? 'true' : undefined}>
					<th scope="row">{row.n}</th>
					{#each SEATED_TYPES as type (type)}<td>{row.counts[type]}</td>{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</Dialog>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
	th,
	td {
		padding: var(--space-1);
	}
	thead th {
		font-size: 0.8rem;
		font-weight: 600;
	}
	tr[aria-current] {
		background: var(--accent);
		color: var(--on-accent);
	}
</style>
