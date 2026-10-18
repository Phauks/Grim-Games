<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { copyText } from '#lib/ui/clipboard.ts';
	import { downloadFile } from '#lib/ui/download.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	/**
	 * A builder's file, shown before it is downloaded (Trevor, 2026-10-18: view the script's
	 * JSON first), with Copy and Download in the header. Read only.
	 */
	interface Props {
		open?: boolean;
		title: string;
		json: unknown;
		fileName: string;
		downloadLabel: string;
	}

	let { open = $bindable(false), title, json, fileName, downloadLabel }: Props = $props();
	const text = $derived(JSON.stringify(json, null, '\t'));
</script>

<Dialog bind:open {title} size="full">
	{#snippet headActions()}
		<!-- Clipboard blocked: the text is still shown to select by hand. -->
		<IconButton icon="copy" label={t('common.copyJson')} onclick={() => void copyText(text)} />
		<IconButton
			icon="download"
			label={downloadLabel}
			onclick={() => downloadFile(fileName, text)}
		/>
	{/snippet}
	<pre class="json" data-testid="builder-json"><code>{text}</code></pre>
</Dialog>

<style>
	/* A full dialog doesn't scroll itself: its content does. */
	.json {
		flex: 1;
		min-height: 0;
		margin: 0;
		overflow: auto;
		font-size: 0.85rem;
		tab-size: 2;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
