<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { reportError } from './report.svelte.ts';

	interface Props {
		/** Where in the app this is, as in `reportError` (e.g. `grimoire`). */
		area: string;
		children: Snippet;
		/** Replaces the default "Couldn't show this" panel; give it the same size (no reflow). */
		fallback?: Snippet<[retry: () => void]>;
	}

	let { area, children, fallback }: Props = $props();
</script>

<!--
	Keeps a crash in one part of a page from taking the whole app down (and with it a game in
	progress): the failure is reported and only this part shows a Try again button.
-->
<svelte:boundary onerror={(error) => reportError(error, { area })}>
	{@render children()}
	<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- the error is already reported -->
	{#snippet failed(error, reset)}
		{#if fallback}
			{@render fallback(reset)}
		{:else}
			<div class="failed" role="status" data-testid="error-boundary">
				<p>Couldn't show this part.</p>
				<Button variant="quiet" onclick={reset}>Try again</Button>
			</div>
		{/if}
	{/snippet}
</svelte:boundary>

<style>
	.failed {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-3);
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		color: var(--on-surface-muted);
	}
	.failed p {
		margin: 0;
	}
</style>
