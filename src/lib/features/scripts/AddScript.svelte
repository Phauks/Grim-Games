<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		guessScriptKind,
		loadScript,
		loadScriptText,
		type KindGuess,
		type LoadedScript,
		type ScriptKind,
		type ScriptLoadResult
	} from '#lib/core/data/index.ts';
	import { addAsCharacters, addAsCollection } from '#lib/features/library/add-as-kind.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
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
	 * Add script: one dialog with a link, pasted JSON and Upload File together (Trevor,
	 * 2026-10-18: one dialog, not a menu of three), and a script file or link dropped anywhere
	 * on the page. Each goes through the Script check, then is
	 * saved to the user's scripts (the Library), or handed to `onloaded`. Mounted by a page's header; `loadFetched`
	 * loads a script that arrived another way (a share link) through the same steps.
	 */
	interface Props {
		/** Called once a script is saved. */
		onsaved?: (script: LoadedScript) => void;
		/** Called with the Library key of characters or a collection added instead of a script. */
		onadded?: (key: string) => void;
		/**
		 * Given, the checked script is handed over here instead of being saved: the page uses
		 * it itself (the Script builder starts from it, Trevor 2026-10-18).
		 */
		onloaded?: (script: LoadedScript, source: ScriptSource) => void;
		busy?: boolean;
		/**
		 * False where only share links are loaded (Search, once the Library has Add script):
		 * no button and no drop target, since adding scripts belongs to the Library.
		 */
		button?: boolean;
	}

	let { onsaved, onadded, onloaded, busy = $bindable(false), button = true }: Props = $props();

	let addOpen = $state(false);
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
		if (onloaded) {
			onloaded(script, source);
			return;
		}
		await chooseScript(script, source);
		onsaved?.(script);
	}

	/**
	 * What the JSON holds, guessed (backlog L23). A guess other than a script is shown with its
	 * reason before anything is added, with a drop-down to change it; a script goes on as before.
	 */
	let kindOpen = $state(false);
	let kindOf = $state.raw<{ guess: KindGuess; fetched: FetchedScript; json: unknown }>();
	let kind = $state<ScriptKind>('script');
	const kindOptions = $derived(
		(['script', 'character', 'collection'] as const).map((k) => ({
			value: k,
			label: t(`library.kindName.${k}`)
		}))
	);

	/** Sources that only publish scripts: their own label wins over the guess. */
	function scriptOnly(source: ScriptSource): boolean {
		return (
			source.kind !== 'paste' && source.kind !== 'file' && !(source.kind === 'link' && !source.page)
		);
	}

	function parsed(text: string): unknown {
		try {
			return JSON.parse(relaxJson(text.replace(/^\uFEFF/, '').trim()));
		} catch {
			return undefined;
		}
	}

	async function settle(fetched: FetchedScript) {
		if (!onloaded) {
			const json = parsed(fetched.text);
			const guess = guessScriptKind(json, scriptOnly(fetched.source));
			if (guess.kind !== 'script') {
				addOpen = false;
				kindOf = { guess, fetched, json };
				kind = guess.kind;
				kindOpen = true;
				return;
			}
		}
		await settleScript(fetched);
	}

	/** Adds what the kind confirmation settled on. */
	async function confirmKind() {
		const chosen = kindOf;
		if (!chosen) return;
		if (kind === 'script') return settleScript(chosen.fetched);
		const json = Array.isArray(chosen.json) ? chosen.json : [chosen.json];
		const script = loadScript(json, await loadOfficialData()).script;
		if (!script) return;
		const { source } = chosen.fetched;
		const name =
			script.meta.name ||
			(source.kind === 'file' ? source.fileName.replace(/\.json$/i, '') : '') ||
			t('library.kindName.collection');
		const key = kind === 'character' ? addAsCharacters(script)[0] : addAsCollection(script, name);
		if (key) onadded?.(key);
	}

	/** Parses fetched text, then saves it or asks the Storyteller to check it first. */
	async function settleScript(fetched: FetchedScript) {
		// Hand-edited JSON (comments, trailing commas) loads too.
		const result = loadScriptText(relaxJson(fetched.text), await loadOfficialData());
		addOpen = false;
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
			if (!addOpen) toast(t('scripts.add.failed'), error);
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

	function openAdd() {
		clearError();
		addOpen = true;
	}

	const hasLink = $derived(linkText.trim() !== '');
	const hasPaste = $derived(pasteText.trim() !== '');

	/** Confirm adds whichever of the link and the pasted JSON is filled in. */
	function confirmAdd() {
		if (hasLink) void run(() => fetchLinkTarget(resolveLink(linkText), linkText));
		else if (hasPaste) void run(() => fromText(pasteText));
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
		if (!button || !carriesScript(event)) return;
		event.preventDefault();
		dragDepth++;
	}

	function onDragOver(event: DragEvent) {
		if (!carriesScript(event)) return;
		// Without the button nothing is added, but a dropped file still never replaces the app.
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = button ? 'copy' : 'none';
	}

	/** Dropping a script file (or a link, or JSON text) loads it like Upload File or Paste. */
	function onDrop(event: DragEvent) {
		dragDepth = 0;
		const data = event.dataTransfer;
		if (!data) return;
		event.preventDefault();
		if (!button) return;
		addOpen = false;
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
	<Button icon="add" aria-haspopup="dialog" disabled={busy} onclick={openAdd}
		>{t('scripts.picker.add')}</Button
	>
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

<!-- Every way in at once; whichever is filled in is used. Each keeps its place, and the
     link and the JSON box take turns: filling one disables the other (no reflow). -->
<Dialog bind:open={addOpen} title={t('scripts.picker.add')}>
	<div class="field">
		<!-- Open link is always there, enabled once a site refuses to share its file. -->
		<TextField
			label={t('scripts.link.label')}
			bind:value={linkText}
			type="url"
			inputmode="url"
			placeholder="https://"
			disabled={hasPaste}
			oncommit={() => {
				confirmAdd();
				return true;
			}}
		>
			{#snippet end()}
				<IconButton
					icon="openInNewTab"
					label={t('scripts.link.open')}
					disabled={!errorLink}
					onclick={() => errorLink && window.open(errorLink, '_blank', 'noopener,noreferrer')}
				/>
			{/snippet}
		</TextField>
	</div>
	<div class="field">
		<TextField
			label={t('scripts.paste.label')}
			bind:value={pasteText}
			multiline
			rows={6}
			spellcheck={false}
			autocomplete="off"
			disabled={hasLink}
		/>
		<div class="row">
			<Button variant="quiet" onclick={pasteFromClipboard} disabled={!canReadClipboard || hasLink}
				>{t('scripts.paste.fromClipboard')}</Button
			>
		</div>
	</div>
	<div class="field">
		<!-- Choosing a file adds it straight away, as it always has. -->
		<Button icon="uploadFile" disabled={busy} onclick={() => fileInput?.click()}
			>{t('scripts.picker.file')}</Button
		>
	</div>
	{@render errorLine()}
	{#snippet actions()}
		<ModalActions
			onCancel={() => (addOpen = false)}
			onConfirm={confirmAdd}
			disabled={busy || (!hasLink && !hasPaste)}
		/>
	{/snippet}
</Dialog>

<!-- The guessed kind, with why (Trevor, 2026-10-22: "show guess with a dropdown, show reason
     for choice"). -->
<Dialog bind:open={kindOpen} title={t('scripts.kind.title')}>
	<div class="field">
		<Select
			label={t('scripts.kind.label')}
			value={kind}
			options={kindOptions}
			onChange={(v) => (kind = v)}
		/>
		<p class="reason" data-testid="kind-reason">
			{kindOf ? t(`scripts.kind.reason.${kindOf.guess.reason}`) : ''}
		</p>
	</div>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (kindOpen = false)}
			onConfirm={() => {
				kindOpen = false;
				void confirmKind();
			}}
		/>
	{/snippet}
</Dialog>

<ScriptCheckDialog
	bind:open={checkOpen}
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
		margin: var(--space-3) 0 0;
	}
	.reason {
		min-height: 1lh;
		margin: var(--space-1) 0 0;
		color: var(--on-sheet-muted);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}
	/* Room for three lines is always reserved, so an error never moves the buttons. */
	.error {
		min-height: 3lh;
		margin: 0;
		color: var(--evil);
		overflow-wrap: anywhere;
	}
</style>
