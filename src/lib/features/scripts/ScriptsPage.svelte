<script lang="ts">
	import { onMount } from 'svelte';
	import { CHARACTER_TYPES, scriptToJson } from '#lib/core/data/index.ts';
	import { TYPE_LABELS, TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { scriptPageUrl } from './botcscripts-api.ts';
	import { currentScript, restoreScripts } from './current-script.svelte.ts';
	import { describeSource } from './saved-scripts.ts';
	import ScriptPicker from './ScriptPicker.svelte';
	import ShareControl from './ShareControl.svelte';
	import { decodeSharedScript, shareLink, sharedPayloadFromHash } from './share.ts';

	let picker: ScriptPicker | undefined = $state();

	const script = $derived(currentScript.current);
	const saved = $derived(currentScript.saved);
	const counts = $derived(
		script
			? CHARACTER_TYPES.flatMap((type) => {
					const n = script.characters.filter((c) => c.type === type).length;
					return n === 0 ? [] : [`${n} ${n === 1 ? TYPE_LABELS[type] : TYPE_PLURALS[type]}`];
				}).join(' · ')
			: 'None'
	);

	/** A share link (`/scripts#s=…`) loads its script through the usual checks, then is cleared. */
	async function openSharedLink() {
		const payload = sharedPayloadFromHash(location.hash);
		if (!payload) return;
		history.replaceState(history.state, '', location.pathname);
		try {
			const json = await decodeSharedScript(payload);
			await picker?.loadFetched({ text: JSON.stringify(json), source: { kind: 'share' } });
		} catch (e) {
			toast('Could not open the shared script', errorMessage(e));
		}
	}

	onMount(() => {
		void restoreScripts().then(openSharedLink);
	});

	/** Counts enter/leave pairs, since dragging over child elements fires both repeatedly. */
	let dragDepth = $state(0);
	const dragging = $derived(dragDepth > 0);

	function carriesScript(event: DragEvent): boolean {
		const types = event.dataTransfer?.types ?? [];
		return (
			types.includes('Files') || types.includes('text/plain') || types.includes('text/uri-list')
		);
	}

	function onDragEnter(event: DragEvent) {
		if (!carriesScript(event)) return;
		event.preventDefault();
		dragDepth++;
	}

	function onDragOver(event: DragEvent) {
		if (!carriesScript(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	function onDragLeave() {
		dragDepth = Math.max(0, dragDepth - 1);
	}

	/** Dropping a script file (or a link, or JSON text) loads it like File or Paste. */
	function onDrop(event: DragEvent) {
		dragDepth = 0;
		const data = event.dataTransfer;
		if (!data || !picker) return;
		event.preventDefault();
		const file = data.files[0];
		if (file) {
			void picker.loadFile(file);
			return;
		}
		const text = data.getData('text/uri-list').split('\n')[0] || data.getData('text/plain');
		if (text.trim()) void picker.loadText(text);
	}

	/** The player link for the current script (`/play#s=…`), rebuilt when the script changes. */
	let shareUrl = $state<string>();
	$effect(() => {
		const current = script;
		shareUrl = undefined;
		if (!current) return;
		let stale = false;
		shareLink(location.origin, scriptToJson(current)).then(
			(url) => {
				if (!stale) shareUrl = url;
			},
			(e) => reportError(e, { area: 'scripts', notify: false })
		);
		return () => {
			stale = true;
		};
	});
</script>

<!-- Anywhere on the page, so a missed drop never opens the file in place of the app. -->
<svelte:window
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
/>

<main>
	<h1>Scripts</h1>

	<!-- Same size with or without a script, so choosing one never moves the picker. -->
	<ErrorBoundary area="scripts">
		<section class="current" aria-labelledby="current-heading" data-testid="current-script">
			<h2 id="current-heading">Current script</h2>
			<p class="name" data-testid="current-script-name">{script?.name ?? 'None'}</p>
			<dl>
				<dt>Author</dt>
				<dd>{script?.meta.author || 'None'}</dd>
				<dt>Characters</dt>
				<dd class="counts" data-testid="current-script-counts">{counts}</dd>
				<dt>Source</dt>
				<dd>
					{#if saved?.source.kind === 'botcscripts'}
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={scriptPageUrl(saved.source.scriptId, saved.source.version)}
							target="_blank"
							rel="noopener noreferrer">{describeSource(saved.source)}</a
						>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{:else}
						{saved ? describeSource(saved.source) : 'None'}
					{/if}
				</dd>
			</dl>
			<ShareControl what="script" title={script?.name ?? 'Script'} url={shareUrl} />
		</section>
	</ErrorBoundary>

	<ErrorBoundary area="scripts">
		<ScriptPicker bind:this={picker} />
	</ErrorBoundary>

	<!-- An overlay, so the page never moves while something is dragged over it. -->
	<div class="drop" class:active={dragging} aria-hidden={!dragging} data-testid="drop-overlay">
		<p>Drop the script file to load it</p>
	</div>
</main>

<style>
	.drop {
		position: fixed;
		inset: 0;
		z-index: var(--z-raised);
		display: grid;
		place-items: center;
		padding: var(--space-5);
		border: 3px dashed var(--accent);
		background: var(--backdrop);
		pointer-events: none;
		opacity: 0;
		transition: opacity var(--duration-fast) var(--ease-out);
	}
	.drop.active {
		opacity: 1;
	}
	.drop p {
		margin: 0;
		padding: var(--space-4);
		border-radius: var(--card-radius);
		background: var(--card-background);
		color: var(--heading);
		font-size: 1.3rem;
	}
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
		display: grid;
		gap: var(--space-5);
	}
	h1 {
		margin: 0;
		font-size: 2rem;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.current {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
	.name {
		margin: 0;
		font-size: 1.3rem;
		color: var(--heading);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Counts may need two lines on a phone; both are always reserved, so nothing moves. */
	.counts {
		min-height: 2lh;
		white-space: normal;
	}
	dd a {
		min-height: auto;
		color: inherit;
	}
</style>
