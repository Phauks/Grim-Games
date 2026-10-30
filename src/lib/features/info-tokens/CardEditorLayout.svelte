<!--
	An info card's editor: the card as players will see it, updated while typing (Trevor,
	2026-10-16), beside its fields. The custom card editor and the quick card share it.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import ShownCard from '#lib/features/show/ShownCard.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';

	interface Props {
		/** The card's words, or nothing when the card shows only its detail. */
		title?: string;
		/** The filled-in part, where the card asks for something. */
		detail?: string;
		/** The fields that edit the card. */
		children: Snippet;
	}

	let { title, detail, children }: Props = $props();
</script>

<div class="editor">
	<figure class="preview" aria-label={t('info-tokens.preview')}>
		<div class="preview-card">
			<ShownCard {title} {detail} compact />
		</div>
	</figure>
	<div class="fields">
		{@render children()}
	</div>
</div>

<style>
	/* Side by side when there is room, preview first on a phone. */
	.editor {
		display: grid;
		gap: var(--space-3);
	}
	@media (min-width: 48rem) {
		.editor {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
		}
		.preview {
			order: 2;
		}
	}
	.fields {
		display: grid;
		gap: var(--space-3);
		align-content: start;
	}
	/* A fixed box, so typing never moves the editor (no reflow, Trevor). */
	.preview {
		margin: 0;
		height: calc(9 * var(--u));
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--card-radius);
		background: var(--surface, Canvas);
		color: var(--on-surface);
	}
	/* The card fills the box, so if it must scroll its scrollbar is at the box's edge, not
	   beside the centred text (Trevor, 2026-10-18). */
	.preview-card {
		height: 100%;
		display: grid;
	}
</style>
