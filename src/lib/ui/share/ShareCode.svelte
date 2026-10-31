<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CopyButton from './CopyButton.svelte';

	/**
	 * A code to type on another device, in large type under its header with Copy beside it:
	 * the share screen's room code (SharePanel) and Room transfer's code. Copy copies the code
	 * alone, without the spaces that group it for reading (Trevor, 2026-10-19).
	 */
	interface Props {
		label: string;
		/** As it is read ("482 913"); dots hold its place until it comes. */
		value: string | undefined;
		testid?: string;
		/** Beside the header, e.g. the Storyteller's room connection (Trevor, 2026-10-31). */
		status?: Snippet;
	}

	let { label, value, testid = 'share-code', status }: Props = $props();

	const id = $props.id();
</script>

<div class="code-block">
	<!-- The code and the link each under a header (Trevor, 2026-10-20). -->
	<div class="head">
		<h2 class="header" {id}>{label}</h2>
		{@render status?.()}
	</div>
	<div class="code-row">
		<p class="code" aria-labelledby={id} data-testid={testid}>
			{value ?? '··· ···'}
		</p>
		<CopyButton
			label={t('share.copyCode')}
			text={value?.replace(/\s/g, '')}
			failed={t('share.copyCodeFailed')}
		/>
	</div>
</div>

<style>
	.code-block {
		display: grid;
		gap: var(--space-1);
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.header {
		margin: 0;
		font-size: 1.1rem;
	}
	/* The copy icon sits right after the code. */
	.code-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.code {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 2.6rem;
		letter-spacing: 0.08em;
		font-variant-numeric: tabular-nums;
	}
</style>
