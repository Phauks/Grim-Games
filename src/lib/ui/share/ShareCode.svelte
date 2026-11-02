<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
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
		/**
		 * An eye beside Copy hides the code from anyone looking at the screen, as a password
		 * field's eye does (Room transfer, Trevor 2026-10-31). Copy still copies it. It starts
		 * hidden (Trevor, 2026-11-01: "room transfer code should start hidden").
		 */
		hideable?: boolean;
	}

	let { label, value, testid = 'share-code', status, hideable = false }: Props = $props();

	let hidden = $state(untrack(() => hideable));
	/** One dot per character, spaces kept, so the hidden code reads as the same shape. */
	const masked = $derived(value?.replace(/\S/g, '•'));

	const id = $props.id();
</script>

<div class="code-block">
	<!-- The code and the link each under a header (Trevor, 2026-10-20). -->
	<div class="head">
		<h2 class="header" {id}>{label}</h2>
		{@render status?.()}
	</div>
	<div class="code-row">
		<!-- The code keeps its place while hidden, under the dots, so nothing moves. -->
		<p class="code" aria-labelledby={id}>
			<span class="value" class:concealed={hidden} data-testid={testid} aria-hidden={hidden}>
				{value ?? '··· ···'}
			</span>
			{#if hidden}<span class="mask" data-testid="{testid}-hidden">{masked ?? '··· ···'}</span>{/if}
		</p>
		<CopyButton
			label={t('share.copyCode')}
			text={value?.replace(/\s/g, '')}
			failed={t('share.copyCodeFailed')}
		/>
		{#if hideable}
			<IconButton
				icon={hidden ? 'show' : 'hide'}
				label={t('share.hideCode')}
				aria-pressed={hidden}
				onclick={() => (hidden = !hidden)}
			/>
		{/if}
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
		display: grid;
	}
	.value,
	.mask {
		grid-area: 1 / 1;
	}
	.concealed {
		visibility: hidden;
	}
</style>
