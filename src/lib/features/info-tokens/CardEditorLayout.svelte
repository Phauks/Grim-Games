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

	let card = $state<HTMLDivElement>();

	/**
	 * Long words shrink until the whole card fits the box, so none of it drops out of sight
	 * while typing (Trevor, 2026-10-31); past the smallest size the card scrolls instead.
	 */
	function fit() {
		const content = card?.firstElementChild;
		if (!card || !(content instanceof HTMLElement)) return;
		let scale = 1;
		card.style.setProperty('--card-fit', '1');
		while (scale > MIN_FIT && content.scrollHeight > content.clientHeight) {
			scale = Math.max(MIN_FIT, scale - 0.05);
			card.style.setProperty('--card-fit', String(scale));
		}
	}
	const MIN_FIT = 0.3;

	$effect(() => {
		void title;
		void detail;
		fit();
	});
	$effect(() => {
		if (!card) return;
		const observer = new ResizeObserver(() => fit());
		observer.observe(card);
		return () => observer.disconnect();
	});
</script>

<div class="editor">
	<figure class="preview" aria-label={t('info-tokens.preview')}>
		<div class="preview-card" bind:this={card}>
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
	@media (min-width: 48rem) {
		.editor {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
		}
		/* Beside the fields, a taller box moves nothing, so long words stay readable. */
		.preview {
			order: 2;
			height: calc(16 * var(--u));
		}
	}
	/* The card fills the box, so if it must scroll its scrollbar is at the box's edge, not
	   beside the centred text (Trevor, 2026-10-18). */
	.preview-card {
		height: 100%;
		display: grid;
		/* The card is held to the box, so it scrolls rather than spilling out of sight. */
		grid-template-rows: minmax(0, 1fr);
	}
</style>
