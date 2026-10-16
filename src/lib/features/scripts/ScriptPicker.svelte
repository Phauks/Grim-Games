<script lang="ts">
	import { onMount } from 'svelte';
	import {
		editionScript,
		loadScriptText,
		OFFICIAL_EDITIONS,
		type LoadedScript,
		type ScriptLoadResult
	} from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { BOTC_SCRIPTS_ORIGIN, parseBotcScriptsRef } from './botcscripts-api.ts';
	import {
		chooseScript,
		currentScript,
		forgetScript,
		recentScripts,
		restoreScripts
	} from './current-script.svelte.ts';
	import {
		fetchLinkTarget,
		readScriptFile,
		ScriptFetchError,
		type FetchedScript
	} from './fetch-script.ts';
	import {
		describeSource,
		reloadSavedScript,
		type SavedScript,
		type ScriptSource
	} from './saved-scripts.ts';
	import WordCodeEntry from '#lib/features/codes/WordCodeEntry.svelte';
	import BotcScriptsBrowser from './BotcScriptsBrowser.svelte';
	import { SHARE_CODE_WORDS } from './share-codes-api.ts';
	import { fetchSharedCode } from './share-codes.ts';
	import ScriptCheckDialog from './ScriptCheckDialog.svelte';
	import { resolveLink } from './script-links.ts';

	interface Props {
		/** Called after a script is chosen (it is already the current script). */
		onchoose?: (script: LoadedScript) => void;
	}

	let { onchoose }: Props = $props();

	/** How many custom scripts the Recent section shows. */
	const RECENT_SHOWN = 5;

	let pasteOpen = $state(false);
	let linkOpen = $state(false);
	let botcOpen = $state(false);
	let codeOpen = $state(false);
	let checkOpen = $state(false);

	let pasteText = $state('');
	let linkText = $state('');
	let botcText = $state('');
	let codeText = $state('');
	let error = $state('');
	let errorLink = $state<string | undefined>(undefined);
	let busy = $state(false);

	let checking = $state.raw<{ result: ScriptLoadResult; source: ScriptSource } | undefined>();
	let fileInput: HTMLInputElement | undefined = $state();

	const recent = $derived(recentScripts.list.filter((s) => !s.edition).slice(0, RECENT_SHOWN));
	const canReadClipboard =
		typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function';

	onMount(() => void restoreScripts());

	function clearError() {
		error = '';
		errorLink = undefined;
	}

	function closeAll() {
		pasteOpen = linkOpen = botcOpen = codeOpen = false;
	}

	async function use(script: LoadedScript, source: ScriptSource) {
		await chooseScript(script, source);
		onchoose?.(script);
	}

	/** Parses fetched text, then loads it or asks the Storyteller to check it first. */
	async function settle(fetched: FetchedScript) {
		const result = loadScriptText(fetched.text, await loadOfficialData());
		closeAll();
		const needsCheck = !result.script || result.problems.some((p) => p.severity !== 'info');
		if (needsCheck) {
			checking = { result, source: fetched.source };
			checkOpen = true;
		} else if (result.script) {
			await use(result.script, fetched.source);
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
		} finally {
			busy = false;
		}
	}

	async function chooseEdition(id: string) {
		const script = editionScript(id, await loadOfficialData());
		if (script) await use(script, { kind: 'edition' });
	}

	async function chooseRecent(saved: SavedScript) {
		const script = reloadSavedScript(saved, await loadOfficialData());
		if (script) await use(script, saved.source);
	}

	function isLink(text: string): boolean {
		return /^https?:\/\//i.test(text.trim()) || parseBotcScriptsRef(text) !== undefined;
	}

	function loadPaste() {
		const text = pasteText;
		void run(() =>
			isLink(text)
				? fetchLinkTarget(resolveLink(text), text)
				: Promise.resolve({ text, source: { kind: 'paste' } })
		);
	}

	async function pasteFromClipboard() {
		clearError();
		try {
			pasteText = await navigator.clipboard.readText();
		} catch {
			error = 'The clipboard could not be read. Long-press in the box and choose Paste.';
		}
	}

	function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) void run(() => readScriptFile(file));
	}

	/** Loads script text that arrived another way (a share link), through the same checks. */
	export function loadFetched(fetched: FetchedScript): Promise<void> {
		return run(() => Promise.resolve(fetched));
	}

	/** A file dropped on the page: loaded like the File button. */
	export function loadFile(file: File): Promise<void> {
		closeAll();
		return run(() => readScriptFile(file));
	}

	/** Text dropped on the page (a link or script JSON): loaded like Paste. */
	export function loadText(text: string): Promise<void> {
		closeAll();
		return run(() =>
			isLink(text)
				? fetchLinkTarget(resolveLink(text), text)
				: Promise.resolve({ text, source: { kind: 'paste' } })
		);
	}

	function open(which: 'paste' | 'link' | 'botc' | 'code') {
		clearError();
		pasteOpen = which === 'paste';
		linkOpen = which === 'link';
		botcOpen = which === 'botc';
		codeOpen = which === 'code';
	}
</script>

<div class="picker">
	<section aria-labelledby="official-heading">
		<h2 id="official-heading">Official</h2>
		<div class="row editions">
			{#each OFFICIAL_EDITIONS as edition (edition.id)}
				<Button
					variant={currentScript.saved?.edition === edition.id ? 'accent' : 'solid'}
					aria-pressed={currentScript.saved?.edition === edition.id}
					onclick={() => chooseEdition(edition.id)}>{edition.name}</Button
				>
			{/each}
		</div>
	</section>

	<section aria-labelledby="recent-heading">
		<h2 id="recent-heading">Recent</h2>
		{#if recent.length === 0}
			<p class="none" data-testid="recent-none">None</p>
		{:else}
			<ul class="recent">
				{#each recent as saved (saved.scriptId)}
					<li>
						<button
							type="button"
							class="recent-item"
							aria-current={currentScript.saved?.scriptId === saved.scriptId ? 'true' : undefined}
							onclick={() => chooseRecent(saved)}
						>
							<span class="name">{saved.name}</span>
							<span class="source">{describeSource(saved.source)}</span>
						</button>
						<IconButton
							icon="close"
							label="Remove {saved.name} from Recent"
							onclick={() =>
								forgetScript(saved.scriptId).catch((e) => reportError(e, { area: 'scripts' }))}
						/>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section aria-labelledby="custom-heading">
		<h2 id="custom-heading">Custom script</h2>
		<div class="row custom">
			<Button onclick={() => open('paste')}>Paste</Button>
			<Button onclick={() => fileInput?.click()} disabled={busy}>File</Button>
			<Button onclick={() => open('link')}>Link</Button>
			<Button onclick={() => open('botc')}>BotC Scripts</Button>
			<Button onclick={() => open('code')}>Code</Button>
		</div>
		<!-- Not limited to application/json: some iPad and Android file providers don't label
		     .json files with that type, which greyed them out in Pocket Grimoire (PG 126, PG 162). -->
		<input
			bind:this={fileInput}
			class="file"
			type="file"
			accept=".json,application/json,text/plain"
			aria-label="Script file"
			onchange={onFile}
		/>
		<!-- File errors have no dialog of their own; the line is always there, so no reflow. -->
		<p class="error" role="status" data-testid="file-error">
			{#if !pasteOpen && !linkOpen && !botcOpen && !codeOpen}{error}{/if}
		</p>
	</section>
</div>

{#snippet errorLine()}
	<p class="error" role="status">{error}</p>
{/snippet}

<Dialog bind:open={pasteOpen} title="Paste a script">
	<label class="field">
		<span>Script JSON or link</span>
		<textarea bind:value={pasteText} rows="8" spellcheck="false" autocomplete="off"></textarea>
	</label>
	{@render errorLine()}
	{#snippet actions()}
		<Button variant="quiet" onclick={pasteFromClipboard} disabled={!canReadClipboard}
			>Paste from clipboard</Button
		>
		<Button variant="accent" onclick={loadPaste} disabled={busy || pasteText.trim() === ''}
			>Load</Button
		>
	{/snippet}
</Dialog>

<Dialog bind:open={linkOpen} title="Load from a link">
	<label class="field">
		<span>Link to the script JSON</span>
		<input
			type="url"
			inputmode="url"
			autocomplete="off"
			placeholder="https://"
			bind:value={linkText}
		/>
	</label>
	{@render errorLine()}
	{#snippet actions()}
		<!-- Always there, enabled once a site refuses to share its file (no reflow). -->
		<Button
			variant="quiet"
			disabled={!errorLink}
			onclick={() => errorLink && window.open(errorLink, '_blank', 'noopener,noreferrer')}
			>Open link</Button
		>
		<Button
			variant="accent"
			onclick={() => run(() => fetchLinkTarget(resolveLink(linkText), linkText))}
			disabled={busy || linkText.trim() === ''}>Load</Button
		>
	{/snippet}
</Dialog>

<Dialog bind:open={botcOpen} title="BotC Scripts" size="full">
	<BotcScriptsBrowser
		bind:query={botcText}
		disabled={busy}
		onpick={(ref) => run(() => fetchLinkTarget({ kind: 'botcscripts', ref }, ''))}
	/>
	{@render errorLine()}
	{#snippet actions()}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="external" href={BOTC_SCRIPTS_ORIGIN} target="_blank" rel="noopener noreferrer"
			>Open BotC Scripts</a
		>
		<Button
			variant="accent"
			onclick={() =>
				run(() => {
					const ref = parseBotcScriptsRef(botcText);
					if (!ref) {
						throw new ScriptFetchError('Enter a botcscripts.com script link or its number.');
					}
					return fetchLinkTarget({ kind: 'botcscripts', ref }, botcText);
				})}
			disabled={busy || !parseBotcScriptsRef(botcText)}>Load</Button
		>
	{/snippet}
</Dialog>

<Dialog bind:open={codeOpen} title="Have a code?" size="full">
	{#if codeOpen}
		<WordCodeEntry count={SHARE_CODE_WORDS} bind:value={codeText} disabled={busy} />
	{/if}
	{@render errorLine()}
	{#snippet actions()}
		<Button
			variant="accent"
			onclick={() => run(() => fetchSharedCode(codeText))}
			disabled={busy || codeText === ''}>Load</Button
		>
	{/snippet}
</Dialog>

<ScriptCheckDialog
	bind:open={checkOpen}
	result={checking?.result}
	onconfirm={() => {
		const script = checking?.result.script;
		if (script && checking) void use(script, checking.source);
	}}
/>

<style>
	.picker {
		display: grid;
		gap: var(--space-4);
	}
	section {
		display: grid;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.row {
		display: grid;
		gap: var(--space-2);
	}
	.editions {
		grid-template-columns: repeat(3, 1fr);
	}
	.custom {
		grid-template-columns: repeat(5, 1fr);
	}
	@media (max-width: 30rem) {
		.editions {
			grid-template-columns: 1fr;
		}
		.custom {
			grid-template-columns: repeat(2, 1fr);
		}
		/* The odd one out spans the row rather than leaving a gap. */
		.custom > :global(:last-child) {
			grid-column: 1 / -1;
		}
	}
	.none {
		margin: 0;
		min-height: var(--tap-target);
		display: flex;
		align-items: center;
		color: var(--on-surface-muted);
	}
	.recent {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--space-1);
	}
	.recent li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.recent-item {
		flex: 1;
		min-width: 0;
		min-height: var(--tap-target);
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		text-align: left;
	}
	.recent-item:hover,
	.recent-item[aria-current='true'] {
		background: var(--surface-selected);
	}
	.recent-item .name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.recent-item .source {
		margin-left: auto;
		flex-shrink: 0;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
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
		font-size: max(1rem, 16px);
	}
	.field textarea {
		resize: vertical;
		font-size: max(0.9rem, 16px);
	}
	/* Room for three lines is always reserved, so an error never moves the buttons. */
	.error {
		min-height: 3lh;
		margin: var(--space-2) 0 0;
		color: var(--evil);
		overflow-wrap: anywhere;
	}
	.external {
		display: inline-flex;
		align-items: center;
		margin-right: auto;
	}
</style>
