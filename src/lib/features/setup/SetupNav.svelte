<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ResolvedPathname } from '$app/types';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';

	interface Props {
		/** Where Back goes, and its label. */
		backHref: ResolvedPathname;
		backLabel: string;
		/** The step's main action, on the right. */
		next: Snippet;
	}

	let { backHref, backLabel, next }: Props = $props();
</script>

<!--
	The same bar at the bottom of every setup step (Trevor, 2026-10-16): Back on the left,
	the step's main action on the right.
-->
<div class="space">
	<nav class="setup-nav" aria-label={t('setup.nav')}>
		<div class="bar">
			<Button variant="quiet" icon="back" href={backHref}>{backLabel}</Button>
			{@render next()}
		</div>
	</nav>
</div>

<style>
	/* Holds the bar's room at the end of the page so nothing ends up under it. */
	.space {
		min-height: calc(var(--tap-target) + 2 * var(--space-2) + env(safe-area-inset-bottom));
		margin-top: var(--space-4);
	}
	/* Pinned to the screen's bottom edge, so it sits in the same place on every step. */
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
