<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
	import FieldValue from './FieldValue.svelte';
	import { REFERENCE_FIELDS } from './fields.ts';
	import { near } from '#lib/ui/near.ts';

	interface Props {
		entry: ReferenceEntry;
		/** Opens the shared details overlay (e.g. why there are no pre-day reminders). */
		onExplain: (title: string, text: string, character?: Character) => void;
	}

	let { entry, onExplain }: Props = $props();

	const character = $derived(entry.character);
	const body = REFERENCE_FIELDS.filter((f) => f.card !== 'header');
	// The body is built when the card comes near the screen (near.ts); until then the
	// card keeps its estimated size, so the page does not jump.
	let shown = $state(false);
</script>

<!-- Every field in REFERENCE_FIELDS, the same list the table renders. -->
<article
	class="card"
	id={character.id}
	data-testid="reference-card"
	data-character={character.id}
	{@attach near(() => (shown = true))}
>
	<!-- The card is the size container; this grid inside it changes with the card's width. -->
	<div class="fields">
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

		{#each shown ? body : [] as field (field.id)}
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
	</div>
</article>

<style>
	.card {
		position: relative;
		padding: var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
		min-width: 0;
		container-type: inline-size;
		/* Off-screen cards skip layout and paint; the size estimate keeps the scrollbar steady. */
		content-visibility: auto;
		contain-intrinsic-size: auto calc(34 * var(--u));
		scroll-margin-top: calc(var(--tap-target) + var(--space-4));
	}
	.fields {
		display: grid;
		gap: var(--space-2);
		/* minmax(0, …): rows wrap to the card's width instead of widening it past the screen. */
		grid-template-columns: minmax(0, 1fr);
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
	/* A narrow card (a small phone, or large text) puts the name on its own line under the
	   token, so a long name badge never runs past the screen. */
	@container (max-width: 18rem) {
		header {
			flex-wrap: wrap;
		}
		.title {
			flex-basis: 100%;
			order: 1;
		}
		header > :global(.value[data-field='icons']) {
			margin-left: auto;
		}
	}
	/* A long card (laptop, desktop): the ability under the header across the card, the other
	   fields side by side in columns, so the card reads across rather than down (Trevor,
	   2026-10-16). A narrow card keeps one stacked column. */
	@container (min-width: 40rem) {
		.fields {
			grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
			gap: var(--space-2) var(--space-5);
			align-items: start;
		}
		header,
		.block {
			grid-column: 1 / -1;
		}
		header {
			order: -2;
		}
		.block[data-row='ability'] {
			order: -1;
		}
	}
	h3 {
		margin: 0;
		font-size: 1rem;
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
		/* Its narrowest width counts, so a value that can't fit beside the label moves under it. */
		min-width: auto;
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
