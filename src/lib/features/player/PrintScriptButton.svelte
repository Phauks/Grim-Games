<script lang="ts" module>
	/** A printable file the script's source publishes (a Carousel "Script PDF", a BotC Scripts upload). */
	export interface SourcePrint {
		label: string;
		url: string;
	}
</script>

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { tick } from 'svelte';
	import { scriptToJson, type LoadedScript } from '#lib/core/data/index.ts';
	import { scriptToolLink } from '#lib/features/scripts/script-tool-link.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ScriptPrintSheet from './ScriptPrintSheet.svelte';

	/**
	 * Print opens the ways to print a script (Trevor, 2026-10-19: routes 1, 3 and 4 of
	 * print-routes.md): the source's own files, linked and never copied; TPI's Script Tool by a
	 * plain link; and our own sheet, which works offline (front: characters; back: night order
	 * and player counts; the print dialog picks the paper). Used by /play and the Scripts page.
	 */
	interface Props {
		script: LoadedScript | undefined;
		/** The script's version, when its source has one; printed beside the author. */
		version?: string;
		/** Files the script's source publishes for printing; each is listed. */
		sourcePrints?: readonly SourcePrint[];
		/** A labelled button rather than an icon. */
		labelled?: boolean;
	}

	let { script, version, sourcePrints = [], labelled = false }: Props = $props();
	let choosing = $state(false);
	let toolLink = $state<string>();
	let printing = $state(false);
	let root = $state<HTMLElement>();
	let sheet = $state<ScriptPrintSheet>();

	/** Moves the printed sheet to the end of <body>, so print CSS can hide everything else. */
	function toBody(node: HTMLElement) {
		document.body.append(node);
		return { destroy: () => node.remove() };
	}

	async function choose() {
		if (!script) return;
		choosing = true;
		toolLink = undefined;
		const json = JSON.stringify(scriptToJson(script));
		toolLink = await scriptToolLink(json).catch(() => undefined);
	}

	async function print() {
		if (!script || printing) return;
		choosing = false;
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
	<Button icon="print" onclick={choose} disabled={!script}>{t('player.print')}</Button>
{:else}
	<IconButton icon="print" label={t('player.print')} onclick={choose} disabled={!script} />
{/if}

<Dialog bind:open={choosing} title={t('player.print')}>
	<ul class="routes" data-testid="print-routes">
		<!-- External pages: the source's own files and TPI's tool, never app routes. -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		{#each sourcePrints as file (file.url)}
			<li>
				<a class="route" href={file.url} target="_blank" rel="noopener noreferrer">
					<Icon name="download" /><span>{file.label}</span>
				</a>
			</li>
		{/each}
		<li>
			<a
				class="route"
				href={toolLink}
				aria-disabled={toolLink ? undefined : 'true'}
				target="_blank"
				rel="noopener noreferrer"
				data-testid="print-script-tool"
			>
				<Icon name="wiki" /><span>{t('player.printScriptTool')}</span>
			</a>
		</li>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<li>
			<button type="button" class="route" onclick={print} data-testid="print-here">
				<Icon name="print" /><span>{t('player.printHere')}</span>
			</button>
		</li>
	</ul>
</Dialog>

{#if printing && script}
	<div class="print-root" bind:this={root} use:toBody>
		<ScriptPrintSheet bind:this={sheet} {script} {version} />
	</div>
{/if}

<style>
	.routes {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.route {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		text-decoration: none;
		cursor: pointer;
		touch-action: manipulation;
	}
	.route[aria-disabled='true'] {
		opacity: 0.5;
		pointer-events: none;
	}
	@media (hover: hover) {
		.route:hover {
			background: var(--surface-selected);
		}
	}
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
