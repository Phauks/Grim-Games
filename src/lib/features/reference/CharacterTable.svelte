<script lang="ts">
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { TYPE_LABELS } from './labels.ts';

	interface Props {
		entries: readonly ReferenceEntry[];
	}

	let { entries }: Props = $props();
</script>

<!-- Scrolls sideways inside its own box on a phone; the page never does. -->
<div class="scroll" role="region" aria-label="Characters table">
	<table data-testid="character-table">
		<thead>
			<tr>
				<th scope="col"><span class="visually-hidden">Token</span></th>
				<th scope="col">Name</th>
				<th scope="col">Type</th>
				<th scope="col">Starting alignment</th>
				<th scope="col">First night</th>
				<th scope="col">Other nights</th>
				<th scope="col">Tokens</th>
				<th scope="col">Setup</th>
				<th scope="col">Jinxes</th>
				<th scope="col">Pre-day</th>
			</tr>
		</thead>
		<tbody>
			{#each entries as entry (entry.character.id)}
				{@const c = entry.character}
				<tr data-character={c.id}>
					<td class="token"><CharacterToken character={c} size={40} /></td>
					<th scope="row" class="name">{c.name}</th>
					<td>{TYPE_LABELS[c.type]}</td>
					<td>{entry.alignmentNote}</td>
					<td class="num">{entry.firstNight.position ? `#${entry.firstNight.position}` : 'None'}</td
					>
					<td class="num">{entry.otherNight.position ? `#${entry.otherNight.position}` : 'None'}</td
					>
					<td class="tokens">
						{#if c.reminders.length || c.remindersGlobal.length}
							{#each [...c.reminders, ...c.remindersGlobal] as token, i (i)}<ReminderToken
									label={token}
									type={c.type}
								/>{/each}
						{:else}None{/if}
					</td>
					<td>{entry.setup?.summary ?? 'None'}</td>
					<td class="num">{entry.jinxes.length || 'None'}</td>
					<td class="num">{entry.dayReminders.length || 'None'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.scroll {
		max-width: 100%;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
	table {
		width: 100%;
		min-width: 56rem;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	th,
	td {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--border);
		text-align: left;
		vertical-align: middle;
	}
	thead th {
		background: var(--surface-selected);
		font-weight: 400;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
		white-space: nowrap;
	}
	.name {
		font-weight: 600;
		white-space: nowrap;
	}
	.token {
		width: 3rem;
		padding-block: var(--space-2);
	}
	.num {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.tokens {
		min-width: 10rem;
	}
	.tokens :global(.reminder) {
		margin: 0.1rem 0.15rem 0.1rem 0;
	}
	tbody tr {
		content-visibility: auto;
		contain-intrinsic-size: auto 3.5rem;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
