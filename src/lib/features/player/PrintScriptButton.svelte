<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { tick } from 'svelte';
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ScriptPrintSheet from './ScriptPrintSheet.svelte';

	/**
	 * Prints a script: the sheet on the front, night order and player counts on the back.
	 * The print dialog chooses the paper (A4 or Letter). Used by /play and the Scripts page.
	 */
	interface Props {
		script: LoadedScript | undefined;
		/** The script's version, when its source has one; printed beside the author. */
		version?: string;
		/** A labelled button rather than an icon. */
		labelled?: boolean;
	}

	let { script, version, labelled = false }: Props = $props();
	let printing = $state(false);
	let root = $state<HTMLElement>();
	let sheet = $state<ScriptPrintSheet>();

	/** Moves the printed sheet to the end of <body>, so print CSS can hide everything else. */
	function toBody(node: HTMLElement) {
		document.body.append(node);
		return { destroy: () => node.remove() };
	}

	async function print() {
		if (!script || printing) return;
		printing = true;
		await tick();
		// Wait for the sheet's data and icons, so the page isn't printed half drawn.
		for (let i = 0; i < 50 && !root?.querySelector('[data-testid="print-sheet"]'); i++)
			await new Promise((r) => setTimeout(r, 100));
		// The sheet is drawn off screen, where lazy icons never load and decode() never settles:
		// load them now, and print after five seconds whatever is still missing.
		const images = [...(root?.querySelectorAll('img') ?? [])];
		for (const img of images) img.loading = 'eager';
		await Promise.race([
			Promise.all(images.map((img) => img.decode().catch(() => undefined))),
			new Promise((r) => setTimeout(r, 5000))
		]);
		// Each side on one page (Trevor, 2026-10-18).
		await sheet?.fit();
		document.documentElement.classList.add('printing');
		const done = () => {
			document.documentElement.classList.remove('printing');
			printing = false;
		};
		window.addEventListener('afterprint', done, { once: true });
		window.print();
	}
</script>

{#if labelled}
	<Button icon="print" onclick={print} disabled={!script}>{t('player.print')}</Button>
{:else}
	<IconButton icon="print" label={t('player.print')} onclick={print} disabled={!script} />
{/if}

{#if printing && script}
	<div class="print-root" bind:this={root} use:toBody>
		<ScriptPrintSheet bind:this={sheet} {script} {version} />
	</div>
{/if}

<style>
	/* Off screen while it is drawn; only the printed page shows it. */
	@media screen {
		.print-root {
			position: fixed;
			top: 0;
			left: -300vw;
			/* A4's printable width with 12 mm margins, so the sheet is fitted at its printed size. */
			width: 186mm;
			visibility: hidden;
		}
	}
	@media print {
		:global(html.printing body > *:not(.print-root)) {
			display: none !important;
		}
		/* A dark theme sets color-scheme: dark on <html>, which paints the page margins black. */
		:global(html.printing),
		:global(html.printing body) {
			color-scheme: light !important;
			background: white !important;
		}
	}
	@page {
		margin: 12mm;
	}
</style>
