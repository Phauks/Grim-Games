<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		loadScriptText,
		type LoadedScript,
		type ScriptLoadResult
	} from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { parseBotcScriptsRef } from './botcscripts-api.ts';
	import { chooseScript } from './current-script.svelte.ts';
	import {
		fetchLinkTarget,
		readScriptFile,
		ScriptFetchError,
		type FetchedScript
	} from './fetch-script.ts';
	import { relaxJson } from './relaxed-json.ts';
	import type { ScriptSource } from './saved-scripts.ts';
	import ScriptCheckDialog from './ScriptCheckDialog.svelte';
	import { resolveLink } from './script-links.ts';

	/**
	 * Add script: Paste JSON, Upload File or Paste Link (Trevor, 2026-10-17), and a script
	 * file or link dropped anywhere on the page. Each goes through the Script check, then is
	 * saved to the user's scripts (the Library). Mounted by a page's header; `loadFetched`
	 * loads a script that arrived another way (a share link) through the same steps.
	 */
	interface Props {
		/** Called once a script is saved. */
		onsaved?: (script: LoadedScript) => void;
		busy?: boolean;
		/**
		 * False where only share links and drops are loaded (Search, once the Library has
		 * Add script): no button, nothing else changes.
		 */
		button?: boolean;
	}

	let { onsaved, busy = $bindable(false), button = true }: Props = $props();

	let adding = $state(false);
	let anchor: HTMLElement | undefined = $state();
	let pasteOpen = $state(false);
	let linkOpen = $state(false);
	let checkOpen = $state(false);
	let pasteText = $state('');
	let linkText = $state('');
	let error = $state('');
	let errorLink = $state<string | undefined>(undefined);
	let checking = $state.raw<{ result: ScriptLoadResult; source: ScriptSource } | undefined>();
	let fileInput: HTMLInputElement | undefined = $state();

	const canReadClipboard =
		typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function';

	function clearError() {
		error = '';
		errorLink = undefined;
	}

	async function save(script: LoadedScript, source: ScriptSource) {
		await chooseScript(script, source);
		onsaved?.(script);
	}

	/** Parses fetched text, then saves it or asks the Storyteller to check it first. */
	async function settle(fetched: FetchedScript) {
		// Hand-edited JSON (comments, trailing commas) loads too.
		const result = loadScriptText(relaxJson(fetched.text), await loadOfficialData());
		pasteOpen = linkOpen = false;
		const needsCheck = !result.script || result.problems.some((p) => p.severity !== 'info');
		if (needsCheck) {
			checking = { result, source: fetched.source };
			checkOpen = true;
		} else if (result.script) {
			await save(result.script, fetched.source);
		}
	}

	async function run(task: () => Promise<FetchedScript>) {
		clearError();
		busy = true;
		try {
			await settle(await task());
		} catch (e) {
			// A refused link or a missing script is expected; anything else is a bug worth logging.
			if (!(e instanceof ScriptFetchError)) reportError(e, { area: 'scripts', notify: false });
			error = errorMessage(e);
			errorLink = e instanceof ScriptFetchError ? e.openUrl : undefined;
			// Outside a dialog the reason shows in a toast, so nothing on the page moves.
			if (!pasteOpen && !linkOpen) toast(t('scripts.add.failed'), error);
		} finally {
			busy = false;
		}
	}

	function isLink(text: string): boolean {
		return /^https?:\/\//i.test(text.trim()) || parseBotcScriptsRef(text) !== undefined;
	}

	function fromText(text: string): Promise<FetchedScript> {
		return isLink(text)
			? fetchLinkTarget(resolveLink(text), text)
			: Promise.resolve({ text, source: { kind: 'paste' } });
	}

	async function pasteFromClipboard() {
		clearError();
		try {
			pasteText = await navigator.clipboard.readText();
		} catch {
			error = t('scripts.paste.clipboardFailed');
		}
	}

	function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) void run(() => readScriptFile(file));
	}

	function choose(which: 'paste' | 'file' | 'link') {
		adding = false;
		clearError();
		if (which === 'file') fileInput?.click();
		else {
			pasteOpen = which === 'paste';
			linkOpen = which === 'link';
		}
	}

	/** Loads script text that arrived another way (a share link), through the same checks. */
	export function loadFetched(fetched: FetchedScript): Promise<void> {
		return run(() => Promise.resolve(fetched));
	}

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

	/** Dropping a script file (or a link, or JSON text) loads it like Upload File or Paste. */
	function onDrop(event: DragEvent) {
		dragDepth = 0;
		const data = event.dataTransfer;
		if (!data) return;
		event.preventDefault();
		pasteOpen = linkOpen = false;
		const file = data.files[0];
		if (file) {
			void run(() => readScriptFile(file));
			return;
		}
		const text = data.getData('text/uri-list').split('\n')[0] || data.getData('text/plain');
		if (text.trim()) void run(() => fromText(text));
	}
</script>

<!-- Anywhere on the page, so a missed drop never opens the file in place of the app. -->
<svelte:window
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={() => (dragDepth = Math.max(0, dragDepth - 1))}
	ondrop={onDrop}
/>

{#if button}
	<span bind:this={anchor}>
		<Button icon="add" aria-haspopup="dialog" disabled={busy} onclick={() => (adding = true)}
			>{t('scripts.picker.add')}</Button
		>
	</span>

	<Popover bind:open={adding} title={t('scripts.picker.add')} {anchor}>
		<div class="add">
			<Button icon="pasteJson" onclick={() => choose('paste')}>{t('scripts.picker.paste')}</Button>
			<Button icon="uploadFile" onclick={() => choose('file')}>{t('scripts.picker.file')}</Button>
			<Button icon="pasteLink" onclick={() => choose('link')}>{t('scripts.picker.link')}</Button>
		</div>
	</Popover>
{/if}

<!-- Not limited to application/json: some iPad and Android file providers don't label
     .json files with that type, which greyed them out in Pocket Grimoire (PG 126, PG 162). -->
<input
	bind:this={fileInput}
	class="file"
	type="file"
	accept=".json,application/json,text/plain"
	aria-label={t('scripts.picker.fileLabel')}
	onchange={onFile}
/>

{#snippet errorLine()}
	<p class="error" role="status">{error}</p>
{/snippet}

<Dialog bind:open={pasteOpen} title={t('scripts.paste.title')}>
	<label class="field">
		<span>{t('scripts.paste.label')}</span>
		<textarea bind:value={pasteText} rows="8" spellcheck="false" autocomplete="off"></textarea>
	</label>
	{@render errorLine()}
	{#snippet actions()}
		<Button variant="quiet" onclick={pasteFromClipboard} disabled={!canReadClipboard}
			>{t('scripts.paste.fromClipboard')}</Button
		>
		<Button
			variant="accent"
			onclick={() => run(() => fromText(pasteText))}
			disabled={busy || pasteText.trim() === ''}>{t('scripts.picker.save')}</Button
		>
	{/snippet}
</Dialog>

<Dialog bind:open={linkOpen} title={t('scripts.link.title')}>
	<label class="field">
		<span>{t('scripts.link.label')}</span>
		<ClearableField bind:value={linkText}>
			<input
				type="url"
				inputmode="url"
				autocomplete="off"
				placeholder="https://"
				bind:value={linkText}
			/>
		</ClearableField>
	</label>
	{@render errorLine()}
	{#snippet actions()}
		<!-- Always there, enabled once a site refuses to share its file (no reflow). -->
		<Button
			variant="quiet"
			disabled={!errorLink}
			onclick={() => errorLink && window.open(errorLink, '_blank', 'noopener,noreferrer')}
			>{t('scripts.link.open')}</Button
		>
		<Button
			variant="accent"
			onclick={() => run(() => fetchLinkTarget(resolveLink(linkText), linkText))}
			disabled={busy || linkText.trim() === ''}>{t('scripts.picker.save')}</Button
		>
	{/snippet}
</Dialog>

<ScriptCheckDialog
	bind:open={checkOpen}
	action="save"
	result={checking?.result}
	onconfirm={() => {
		const script = checking?.result.script;
		if (script && checking) void save(script, checking.source);
	}}
/>

<!-- An overlay, so the page never moves while something is dragged over it. -->
<div class="drop" class:active={dragging} aria-hidden={!dragging} data-testid="drop-overlay">
	<p>{t('scripts.dropHint')}</p>
</div>

<style>
	.add {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
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
	.file {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}
	.field {
		display: grid;
		gap: var(--space-1);
		margin: var(--space-3) 0 0;
	}
	.field input,
	.field textarea {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
	.field textarea {
		resize: vertical;
		font-size: max(0.9rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
	/* Room for three lines is always reserved, so an error never moves the buttons. */
	.error {
		min-height: 3lh;
		margin: 0;
		color: var(--evil);
		overflow-wrap: anywhere;
	}
</style>
