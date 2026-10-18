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
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import MarkerToken from '#lib/ui/token/MarkerToken.svelte';
	import { TYPE_PLURALS } from './labels.ts';
	import NightText from './NightText.svelte';
	import type { ReferenceView } from './view-mode.svelte.ts';

	interface Props {
		data: GameData;
		numeric?: NumericNightOrder;
		view: ReferenceView;
	}

	let { data, numeric, view }: Props = $props();

	// Text filter for the tables: hides steps, never reorders them.
	let query = $state('');
	function matches(s: NightStep): boolean {
		const q = query.trim().toLowerCase();
		if (!q) return true;
		const name =
			s.character?.name ?? (s.kind === 'marker' ? MARKER_TEXT[s.id as NightMarker].name : '');
		// eslint-disable-next-line grim/names-as-badges -- text to search, never shown
		return `${name} ${s.reminder ?? ''}`.toLowerCase().includes(q);
	}

	const nights = $derived(
		(['first', 'other'] as const).map((night) => {
			const order = fullNightOrder(data, night, numeric);
			return {
				night,
				title: night === 'first' ? 'First night' : 'Other nights',
				steps: order.steps,
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

{#snippet text(night: Night, s: NightStep)}
	{#if s.reminder && s.character}<NightText
			text={s.reminder}
			character={s.character}
			{night}
		/>{:else}{s.reminder ?? 'None'}{/if}
{/snippet}

{#snippet row(night: Night, s: NightStep)}
	{@const position = sheetPosition(data.nightSheet, night, s.id)}
	<tr data-step={s.id} data-kind={s.kind} data-after-dawn={s.afterDawn || undefined}>
		<td class="num">#{position ?? '?'}</td>
		<th scope="row">
			{#if s.kind === 'marker'}
				<span class="marker"
					><MarkerToken marker={s.id as NightMarker} size={32} label="" />{MARKER_TEXT[
						s.id as NightMarker
					].name}</span
				>
			{:else if s.character}
				<CharacterBadge characterId={s.character.id} />
			{/if}
		</th>
		<td class="text">
			{@render text(night, s)}
			{#if s.afterDawn}<span class="muted"> (after Dawn: announce to everyone)</span>{/if}
		</td>
		<td class="tokens" data-label="Tokens">
			{#if s.character && (s.character.reminders.length || s.character.remindersGlobal.length)}
				{#each [...s.character.reminders, ...s.character.remindersGlobal] as token, i (i)}<ReminderToken
						label={token}
						type={s.character.type}
					/>{/each}
			{:else}None{/if}
		</td>
	</tr>
{/snippet}

{#snippet step(night: Night, s: NightStep)}
	{@const position = sheetPosition(data.nightSheet, night, s.id)}
	{@const number = numberOf(night, s.id)}
	<li class="step" data-step={s.id} data-kind={s.kind}>
		<span class="pos" title="Position on TPI’s night sheet">#{position ?? '?'}</span>
		<div class="body">
			{#if s.kind === 'marker'}
				<strong class="marker"
					><MarkerToken marker={s.id as NightMarker} size={40} label="" />{MARKER_TEXT[
						s.id as NightMarker
					].name}</strong
				>
			{:else if s.character}
				<CharacterBadge characterId={s.character.id} />
			{/if}
			{#if s.reminder}<p>{@render text(night, s)}</p>{/if}
			{#if number !== undefined}<p class="muted">Provisional number {number}</p>{/if}
			{#each s.notes as note (note)}<p class="muted">{note}</p>{/each}
		</div>
	</li>
{/snippet}

{#if view === 'table'}
	<div class="night-filter">
		<SearchField
			bind:value={query}
			label={t('reference.nightFilterLabel')}
			placeholder={t('reference.nightFilterPlaceholder')}
		/>
	</div>
{/if}

{#each nights as n (n.night)}
	<section class="night" aria-labelledby="night-{n.night}" data-testid="night-{n.night}">
		<h2 id="night-{n.night}">
			{n.title} <span>({n.beforeDawn.length + n.afterDawn.length} steps)</span>
		</h2>
		{#if view === 'table'}
			<!-- Strictly in night order; on a phone each row stacks, so nothing scrolls sideways. -->
			<div class="scroll" role="region" aria-label="{n.title} table">
				<table class="order" data-testid="night-table-{n.night}">
					<thead>
						<tr>
							<th scope="col">#</th>
							<th scope="col">Step</th>
							<th scope="col">Storyteller</th>
							<th scope="col">Tokens</th>
						</tr>
					</thead>
					<tbody>
						{#each n.steps.filter(matches) as s (s.id)}{@render row(n.night, s)}{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<ol class="steps" aria-label="{n.title} until Dawn">
				{#each n.beforeDawn as s (s.id)}{@render step(n.night, s)}{/each}
			</ol>
			{#if n.afterDawn.length}
				<h3>After Dawn: announcements</h3>
				<ol class="steps" aria-label="{n.title} after Dawn">
					{#each n.afterDawn as s (s.id)}{@render step(n.night, s)}{/each}
				</ol>
			{/if}
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
	/* The filter sits above the night tables. */
	.night-filter {
		margin-bottom: var(--space-4);
	}
	.night {
		margin-bottom: var(--space-6);
		container-type: inline-size;
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
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(24 * var(--u))), 1fr));
		gap: var(--space-2) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.step {
		display: grid;
		grid-template-columns: calc(3 * var(--u)) 1fr;
		gap: var(--space-2);
		align-items: start;
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
		content-visibility: auto;
		contain-intrinsic-size: auto calc(8 * var(--u));
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
		font-family: var(--font-control);
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
		gap: var(--space-2);
		min-height: var(--tap-target);
		font-family: var(--font-character);
		color: var(--heading);
	}
	p {
		margin: 0;
	}
	.muted {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.scroll {
		max-width: 100%;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
	table.order {
		min-width: calc(40 * var(--u));
		margin-top: 0;
		table-layout: auto;
		font-size: 0.9rem;
	}
	.order th,
	.order td {
		text-align: left;
		vertical-align: top;
		overflow-wrap: normal;
	}
	.order thead th {
		background: var(--surface-selected);
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.order .num {
		color: var(--heading);
		white-space: nowrap;
	}
	.order tbody th {
		font-weight: 400;
		white-space: nowrap;
	}
	.order tr[data-kind='marker'] {
		background: var(--surface-selected);
	}
	.order .text {
		min-width: calc(18 * var(--u));
	}
	.order .tokens {
		min-width: calc(8 * var(--u));
	}
	.order .tokens :global(.reminder) {
		margin: calc(0.1 * var(--u)) calc(0.15 * var(--u)) calc(0.1 * var(--u)) 0;
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
		font-family: var(--font-control);
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	/* Narrow screens: each step is a block (position and character, then text, then tokens). */
	@container (max-width: 40rem) {
		/*
		 * Nothing scrolls sideways here. clip, not visible: tap areas drawn past a word (the
		 * glossary term's 44px ::after) must not make the box wider whatever the font.
		 */
		.scroll {
			overflow-x: clip;
		}
		table.order,
		.order tbody {
			display: block;
			min-width: 0;
		}
		.order thead {
			display: none;
		}
		.order tr {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			align-items: center;
			gap: var(--space-1) var(--space-2);
			padding: var(--space-2);
			border-bottom: 1px solid var(--border);
		}
		.order th,
		.order td {
			display: block;
			min-width: 0;
			padding: 0;
			border: 0;
			overflow-wrap: anywhere;
		}
		.order tbody th {
			white-space: normal;
		}
		.order .text,
		.order .tokens {
			grid-column: 1 / -1;
			min-width: 0;
		}
		.order .tokens::before {
			content: attr(data-label) ' ';
			color: var(--on-surface-muted);
			font-size: 0.75rem;
			letter-spacing: 0.05em;
			text-transform: uppercase;
		}
	}
</style>
