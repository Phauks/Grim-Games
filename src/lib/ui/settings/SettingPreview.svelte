<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';

	interface Props {
		/** The preview's own test id, if a test needs it. */
		testid?: string;
		children: Snippet;
	}

	let { testid, children }: Props = $props();
	const id = $props.id();
</script>

<!--
	A section's live preview, first in the section and stuck to the top of the settings scroll
	area, so the settings below can be changed while their effect stays in view (Trevor,
	2026-10-17). Give the content a fixed height, so a change never moves the settings.
-->
<section class="setting-preview" aria-labelledby="{id}-title" data-testid={testid}>
	<h3 id="{id}-title">{t('settings.preview')}</h3>
	<div class="body">{@render children()}</div>
</section>

<style>
	.setting-preview {
		position: sticky;
		top: 0;
		z-index: 1;
		margin: 0 0 var(--space-4);
		padding: var(--space-2) 0 var(--space-3);
		background: var(--dialog-background);
		border-bottom: 1px solid var(--border);
	}
	h3 {
		margin: 0 0 var(--space-2);
		font-size: 1rem;
	}
	/* One card look for every preview. Short phone screens: the card scrolls inside itself,
	   leaving room for the settings. */
	.body {
		max-height: 35dvh;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
</style>
