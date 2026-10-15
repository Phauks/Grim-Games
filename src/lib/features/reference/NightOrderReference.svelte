<script lang="ts">
	import type { GameData, NightMarker, NumericNightOrder } from '#lib/core/data/index.ts';
	import {
		BASE_DISTRIBUTION,
		MAX_DEALT_PLAYERS,
		MIN_PLAYERS,
		SEATED_TYPES
	} from '#lib/core/rules/distribution.ts';
	import { MARKER_TEXT, type Night, type NightStep } from '#lib/core/rules/night-order.ts';
	import { fullNightOrder, sheetPosition } from '#lib/core/rules/reference.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { TYPE_PLURALS } from './labels.ts';

	interface Props {
		data: GameData;
		numeric?: NumericNightOrder;
	}

	let { data, numeric }: Props = $props();

	const nights = $derived(
		(['first', 'other'] as const).map((night) => {
			const order = fullNightOrder(data, night, numeric);
			return {
				night,
				title: night === 'first' ? 'First night' : 'Other nights',
				beforeDawn: order.steps.filter((s) => !s.afterDawn),
				afterDawn: order.steps.filter((s) => s.afterDawn),
				omitted: order.omitted
			};
		})
	);
	const players = Array.from(
		{ length: MAX_DEALT_PLAYERS - MIN_PLAYERS + 1 },
		(_, i) => MIN_PLAYERS + i
	);

	function numberOf(night: Night, id: string) {
		return (night === 'first' ? numeric?.firstNight : numeric?.otherNight)?.get(id);
	}
</script>

{#snippet step(night: Night, s: NightStep)}
	{@const position = sheetPosition(data.nightSheet, night, s.id)}
	{@const number = numberOf(night, s.id)}
	<li class="step" data-step={s.id} data-kind={s.kind}>
		<span class="pos" title="Position on TPI’s night sheet">#{position ?? '?'}</span>
		<div class="body">
			{#if s.kind === 'marker'}
				<strong class="marker">{MARKER_TEXT[s.id as NightMarker].name}</strong>
			{:else if s.character}
				<CharacterBadge characterId={s.character.id} />
			{/if}
			{#if s.reminder}<p>{s.reminder}</p>{/if}
			{#if number !== undefined}<p class="muted">Provisional number {number}</p>{/if}
			{#each s.notes as note (note)}<p class="muted">{note}</p>{/each}
		</div>
	</li>
{/snippet}

{#each nights as n (n.night)}
	<section class="night" aria-labelledby="night-{n.night}" data-testid="night-{n.night}">
		<h2 id="night-{n.night}">
			{n.title} <span>({n.beforeDawn.length + n.afterDawn.length} steps)</span>
		</h2>
		<ol class="steps" aria-label="{n.title} until Dawn">
			{#each n.beforeDawn as s (s.id)}{@render step(n.night, s)}{/each}
		</ol>
		{#if n.afterDawn.length}
			<h3>After Dawn: announcements</h3>
			<ol class="steps" aria-label="{n.title} after Dawn">
				{#each n.afterDawn as s (s.id)}{@render step(n.night, s)}{/each}
			</ol>
		{/if}
		{#each n.omitted as o (o.id)}<p class="muted">Left out: {o.id}: {o.reason}</p>{/each}
	</section>
{/each}

<section aria-labelledby="distribution">
	<h2 id="distribution">Character distribution</h2>
	<p class="muted">
		Characters dealt from the bag for each player count (Travellers join beyond {MAX_DEALT_PLAYERS}).
	</p>
	<table>
		<thead>
			<tr>
				<th scope="col">Players</th>
				{#each SEATED_TYPES as type (type)}<th scope="col">{TYPE_PLURALS[type]}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each players as count (count)}
				<tr>
					<th scope="row">{count}</th>
					{#each SEATED_TYPES as type (type)}<td>{BASE_DISTRIBUTION[count][type]}</td>{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style>
	.night {
		margin-bottom: var(--space-6);
	}
	h2 {
		margin: 0 0 var(--space-3);
		font-size: 1.3rem;
	}
	h2 span {
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	h3 {
		margin: var(--space-4) 0 var(--space-3);
		font-size: 1.05rem;
	}
	.steps {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
		gap: var(--space-2) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.step {
		display: grid;
		grid-template-columns: 3rem 1fr;
		gap: var(--space-2);
		align-items: start;
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
		content-visibility: auto;
		contain-intrinsic-size: auto 8rem;
	}
	.step[data-kind='marker'] {
		background: var(--surface-selected);
	}
	.pos {
		display: grid;
		place-items: center;
		min-height: var(--tap-target);
		font-variant-numeric: tabular-nums;
		color: var(--heading);
		font-family: var(--font-display);
	}
	.body {
		display: grid;
		gap: var(--space-1);
		justify-items: start;
		min-width: 0;
	}
	.marker {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap-target);
		font-family: var(--font-display);
		color: var(--heading);
	}
	p {
		margin: 0;
	}
	.muted {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	table {
		width: 100%;
		margin-top: var(--space-3);
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
		table-layout: fixed;
	}
	th,
	td {
		padding: var(--space-2) var(--space-1);
		border-bottom: 1px solid var(--border);
		text-align: center;
		overflow-wrap: anywhere;
	}
	thead th {
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
</style>
