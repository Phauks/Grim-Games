<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import { placeholdersFor } from '#lib/core/rules/night-text.ts';
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import DiffersButton from './DiffersButton.svelte';
	import { TYPE_LABELS } from './labels.ts';
	import SetupBadge from './SetupBadge.svelte';

	interface Props {
		entries: readonly ReferenceEntry[];
	}

	let { entries }: Props = $props();

	const NIGHTS = [
		['first', '1st'],
		['other', 'Other']
	] as const;
</script>

<!-- What each TPI :reminder: means, per night (`REMINDER_PLACEHOLDERS`), for review. -->
{#snippet nightTokens(c: Character)}
	{@const nights = NIGHTS.map(([night, label]) => ({
		label,
		list: c.edition !== undefined ? (placeholdersFor(c.id, night) ?? []) : []
	})).filter((n) => n.list.length > 0)}
	{#each nights as n (n.label)}
		<span class="night-tokens"
			><span class="muted">{n.label}:</span>
			{#each n.list as p, i (i)}{#each p.tokens as t, j (j)}{#if j > 0}{p.either ? ' or ' : ' '}{/if}{#if t.label.toLowerCase() === 'dead'}<ReminderToken
							variant="dead"
							type={c.type}
							action={t.action}
						/>{:else}<ReminderToken
							label={t.label}
							type={c.type}
							characterId={c.id}
							action={t.action}
						/>{/if}{/each}{' '}{/each}</span
		>
	{:else}None{/each}
{/snippet}

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
				<th scope="col">Night tokens</th>
				<th scope="col">Setup</th>
				<th scope="col">Prep</th>
				<th scope="col">Jinxes</th>
				<th scope="col">Pre-day</th>
				<th scope="col">Differs</th>
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
									characterId={c.id}
								/>{/each}
						{:else}None{/if}
					</td>
					<td class="tokens" data-testid="night-tokens">{@render nightTokens(c)}</td>
					<td class="setup"
						>{#if entry.setup}<SetupBadge character={c} setup={entry.setup} />
							{entry.setup.summary}{:else}None{/if}</td
					>
					<td class="num">{entry.prep.length || 'None'}</td>
					<td class="num">{entry.jinxes.length || 'None'}</td>
					<td class="num">{entry.dayReminders.length || 'None'}</td>
					<td
						>{#if entry.differences.length}<DiffersButton
								character={c}
								differences={entry.differences}
							/>{:else}None{/if}</td
					>
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
		min-width: calc(80 * var(--u));
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
		width: calc(3 * var(--u));
		padding-block: var(--space-2);
	}
	.num {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.tokens {
		min-width: calc(10 * var(--u));
	}
	.night-tokens {
		display: block;
		white-space: nowrap;
	}
	.muted {
		color: var(--on-surface-muted);
		font-size: 0.8rem;
	}
	.setup {
		min-width: calc(8 * var(--u));
	}
	.tokens :global(.reminder) {
		margin: calc(0.1 * var(--u)) calc(0.15 * var(--u)) calc(0.1 * var(--u)) 0;
	}
	tbody tr {
		content-visibility: auto;
		contain-intrinsic-size: auto calc(3.5 * var(--u));
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
