<script lang="ts">
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import FieldValue from './FieldValue.svelte';
	import { REFERENCE_FIELDS } from './fields.ts';

	interface Props {
		entry: ReferenceEntry;
		/** Opens the shared details overlay (e.g. why there are no pre-day reminders). */
		onExplain: (title: string, text: string) => void;
	}

	let { entry, onExplain }: Props = $props();

	const character = $derived(entry.character);
	const body = REFERENCE_FIELDS.filter((f) => f.card !== 'header');
</script>

<!-- Every field in REFERENCE_FIELDS, the same list the table renders. -->
<article class="card" id={character.id} data-testid="reference-card" data-character={character.id}>
	<header>
		<FieldValue field="token" {entry} {onExplain} />
		<div class="title">
			<h3><FieldValue field="name" {entry} {onExplain} /></h3>
			<p class="meta">
				<FieldValue field="type" {entry} {onExplain} /> ·
				<FieldValue field="edition" {entry} {onExplain} />
			</p>
		</div>
		<FieldValue field="icons" {entry} {onExplain} />
	</header>

	{#each body as field (field.id)}
		{#if field.card === 'block'}
			<div class="block" data-row={field.id}>
				<FieldValue field={field.id} {entry} {onExplain} />
			</div>
		{:else}
			<div class="row" data-row={field.id}>
				<b>{field.label}</b>
				<FieldValue field={field.id} {entry} {onExplain} />
			</div>
		{/if}
	{/each}
</article>

<style>
	.card {
		position: relative;
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
		min-width: 0;
		/* Off-screen cards skip layout and paint; the size estimate keeps the scrollbar steady. */
		content-visibility: auto;
		contain-intrinsic-size: auto calc(34 * var(--u));
		scroll-margin-top: calc(var(--tap-target) + var(--space-4));
	}
	header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.title {
		flex: 1;
		min-width: 0;
	}
	h3 {
		margin: 0;
		font-size: 1.15rem;
	}
	.meta {
		margin: 0;
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	b {
		margin-right: var(--space-1);
		font-weight: 400;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
		white-space: nowrap;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-2);
		font-size: 0.95rem;
		min-width: 0;
	}
	/* The value sits beside its label when there is room, and wraps under it otherwise. */
	.row > :global(.value) {
		flex: 1 1 calc(8 * var(--u));
	}
	/* Lists (jinxes, pre-day) start on their own line under the label. */
	.row:has(:global(ul)) {
		display: grid;
		gap: var(--space-1);
	}
	.block[data-row='links'] {
		font-size: 0.9rem;
	}
</style>
