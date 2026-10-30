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
	import { scriptLogo, scriptToJson, type LoadedScript } from '#lib/core/data/index.ts';
	import type { PublicRule } from '#lib/core/sync/public-projection.ts';
	import { scriptToolLink } from '#lib/features/scripts/script-tool-link.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ScriptPrintSheet from './ScriptPrintSheet.svelte';
	import PrintSettingsFields from './PrintSettingsFields.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Spinner from '#lib/ui/primitives/Spinner.svelte';

	/**
	 * Print opens the ways to print a script (Trevor, 2026-10-19: routes 1, 3 and 4 of
	 * print-routes.md): the source's own files, linked and never copied; TPI's Script Tool by a
	 * plain link; and our own sheet, which works offline (front: characters; back: night order
	 * and player counts, or what the reader picks). How many to print is the print dialog's
	 * choice (Trevor, 2026-10-29). Used by /play, the board's Script and the Scripts page.
	 */
	interface Props {
		script: LoadedScript | undefined;
		/** The script's version, when its source has one; printed beside the author. */
		version?: string;
		/** Files the script's source publishes for printing; each is listed. */
		sourcePrints?: readonly SourcePrint[];
		/** A labelled button rather than an icon. */
		labelled?: boolean;
		/** The game mode and special rules, when printing from a game. */
		rules?: readonly PublicRule[];
	}

	let { script, version, sourcePrints = [], labelled = false, rules = [] }: Props = $props();
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

	// Our sheet opens its settings beside a live preview first (Trevor, 2026-10-19).
	let setting = $state(false);
	const printChoices = $derived(playerSettings.current.print);
	let preview = $state<ScriptPrintSheet>();
	let previewWidth = $state(0);
	let previewPage = $state<HTMLElement>();
	/** The preview is the printed paper at its real size, zoomed down to the space it has. */
	const previewZoom = $derived(
		previewPage && previewWidth ? previewWidth / previewPage.offsetWidth : 1
	);
	/**
	 * The preview is drawn once the screen is up, and shows a spinner until it first fits: it
	 * used to be drawn and fitted before the screen opened, which felt like a freeze (Trevor,
	 * 2026-10-29: "it seems to lag a bit when opening").
	 */
	let drawn = $state(false);
	let laidOut = $state(false);
	$effect(() => {
		if (!setting || !preview) return;
		void JSON.stringify(printChoices);
		const sheet = preview;
		void tick()
			.then(() => sheet.fit())
			.then(() => (laidOut = true));
	});
	const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));
	async function openSettings() {
		choosing = false;
		drawn = false;
		laidOut = false;
		setting = true;
		// Two frames: the screen paints with its spinner before the sheet is built.
		await nextFrame();
		await nextFrame();
		drawn = true;
	}

	/** The paper and margins for the browser's print dialog, which only CSS can set. */
	function pageRule(): HTMLStyleElement {
		const style = document.createElement('style');
		const size = printChoices.pageSize === 'a4' ? 'A4' : 'letter';
		style.textContent = `@page { size: ${size}; margin: ${printChoices.margin}mm; }`;
		document.head.append(style);
		return style;
	}

	async function print() {
		if (!script || printing) return;
		choosing = false;
		setting = false;
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
		const page = pageRule();
		const done = () => {
			document.documentElement.classList.remove('printing');
			page.remove();
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
			<button type="button" class="route" onclick={openSettings} data-testid="print-here">
				<Icon name="print" /><span>{t('player.printHere')}</span>
			</button>
		</li>
	</ul>
</Dialog>

<Dialog bind:open={setting} title={t('player.printSettings')} size="max">
	<div class="settings">
		<PrintSettingsFields hasLogo={!!script && !!scriptLogo(script)} hasRules={rules.length > 0} />
		<section class="preview" aria-label={t('player.printPreview')} bind:clientWidth={previewWidth}>
			{#if !laidOut}
				<p class="laying-out"><Spinner testid="print-laying-out" />{t('player.printLayingOut')}</p>
			{/if}
			{#if setting && drawn && script}
				<div
					class="paper"
					class:hidden={!laidOut}
					bind:this={previewPage}
					style:zoom={previewZoom}
					data-testid="print-preview"
				>
					<ScriptPrintSheet
						bind:this={preview}
						{script}
						{version}
						{rules}
						settings={printChoices}
						preview
					/>
				</div>
			{/if}
		</section>
	</div>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (setting = false)}
			onConfirm={print}
			confirmLabel={t('player.printConfirm')}
			confirmIcon="print"
		/>
	{/snippet}
</Dialog>

{#if printing && script}
	<div class="print-root" bind:this={root} use:toBody>
		<ScriptPrintSheet bind:this={sheet} {script} {version} {rules} settings={printChoices} />
	</div>
{/if}

<style>
	/* Settings beside the preview where there is room; above it on a phone. */
	.settings {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, calc(28 * var(--u))), 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.preview {
		min-width: 0;
		overflow: hidden;
	}
	/* The paper at its printed size, so the fit matches print; zoomed to the pane. */
	.paper {
		width: max-content;
	}
	/* Laid out unseen until it first fits, so the reader never sees it jump. */
	.paper.hidden {
		visibility: hidden;
		height: 0;
		overflow: hidden;
	}
	.laying-out {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		color: var(--on-surface-muted);
	}
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
			background: var(--print-paper) !important;
		}
	}
</style>
