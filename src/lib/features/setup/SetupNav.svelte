<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ResolvedPathname } from '$app/types';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';

	interface Props {
		/** Where Back goes, and its label; `onBack` instead where Back does more than open a page. */
		backHref?: ResolvedPathname;
		onBack?: () => void;
		/** Back shown but off (a step that can no longer go back without losing what was done). */
		backDisabled?: boolean;
		backLabel: string;
		/** The step's main action, on the right. */
		next: Snippet;
	}

	let { backHref, onBack, backDisabled = false, backLabel, next }: Props = $props();
</script>

<!--
	The same bar at the bottom of every setup step (Trevor, 2026-10-16): Back on the left,
	the step's main action on the right.
-->
<nav class="setup-nav pinned-bottom" aria-label={t('setup.nav')}>
	<div class="bar">
		{#if onBack}<Button
				variant="quiet"
				icon="back"
				disabled={backDisabled}
				onclick={onBack}
				data-way-back>{backLabel}</Button
			>
		{:else}<Button variant="quiet" icon="back" href={backHref} data-way-back>{backLabel}</Button
			>{/if}
		{@render next()}
	</div>
</nav>

<style>
	/* Pinned to the screen's bottom edge, so it sits in the same place on every step. Its room
	   is kept below the whole page (`.pinned-bottom` in base.css). */
	.setup-nav {
		position: fixed;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: var(--z-raised);
		border-top: 1px solid var(--border);
		background: var(--page-background, var(--surface));
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-2) var(--page-gutter) calc(var(--space-2) + env(safe-area-inset-bottom));
	}
</style>
