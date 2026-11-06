<script lang="ts">
	import { loadScriptText, type LoadedScript } from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import AddScript from '#lib/features/scripts/AddScript.svelte';
	import OnlineScripts from '#lib/features/scripts/OnlineScripts.svelte';
	import ScriptCheckDialog from '#lib/features/scripts/ScriptCheckDialog.svelte';
	import ScriptName from '#lib/features/scripts/ScriptName.svelte';
	import { chooseScript, currentScript } from '#lib/features/scripts/current-script.svelte.ts';
	import { ScriptFetchError } from '#lib/features/scripts/fetch-script.ts';
	import { relaxJson } from '#lib/features/scripts/relaxed-json.ts';
	import { reloadSavedScript, type ScriptSource } from '#lib/features/scripts/saved-scripts.ts';
	import type { ScriptListing } from '#lib/features/scripts/script-providers.ts';
	import { GROUPED_SOURCES, type PageSource } from '#lib/features/scripts/search-sources.ts';
	import { targetText } from '#lib/features/scripts/target-text.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { searchableScripts, type ScriptChoice } from './script-choices.svelte.ts';

	/**
	 * Choose a script (Trevor, 2026-11-06, option B of "Custom script picker"): one sheet for
	 * every custom script, wherever a script is chosen (New game, a mode's script, a room
	 * vote's choice, /play). Where says what is searched: this device's scripts (Recent, then
	 * the Library) or one of Search's online sources, so nothing sends the Storyteller off
	 * the screen they were on. Add script (link, paste, Upload File, Take a Photo) is the + in
	 * its header. A script picked online is saved to Recent, as Search saves it.
	 */
	interface Props {
		open?: boolean;
		/** The script chosen now, marked in the list. */
		value?: ScriptChoice;
		/** A script was picked: a base script's id, or a saved script's `recent:` or `profile:`. */
		onpick: (choice: ScriptChoice) => void;
	}

	let { open = $bindable(false), value, onpick }: Props = $props();

	const DEVICE = 'device';
	type Where = typeof DEVICE | PageSource;
	let where = $state<Where>(DEVICE);
	let term = $state('');
	let busy = $state(false);
	let adder: AddScript | undefined = $state();

	const whereOptions = $derived([
		{ value: DEVICE as Where, label: t('modes.scriptSheet.device') },
		...GROUPED_SOURCES.map((s) => ({
			value: s as Where,
			label: t(`scripts.picker.source.${s}`)
		}))
	]);

	// Each time it opens: this device's scripts, nothing typed.
	$effect.pre(() => {
		if (!open) return;
		where = DEVICE;
		term = '';
	});

	const GROUPS = ['recent', 'library'] as const;
	const deviceScripts = $derived.by(() => {
		const typed = term.trim().toLowerCase();
		return searchableScripts().filter(
			(o) =>
				!typed ||
				o.label.toLowerCase().includes(typed) ||
				(o.author?.toLowerCase().includes(typed) ?? false)
		);
	});

	function finish(choice: ScriptChoice) {
		open = false;
		onpick(choice);
	}

	/** Saves the script to Recent, then picks it there. */
	async function save(script: LoadedScript, source: ScriptSource) {
		await chooseScript(script, source);
		const saved = currentScript.saved;
		if (saved) finish(`recent:${saved.scriptId}`);
	}

	let checkOpen = $state(false);
	let checking = $state.raw<{ result: ReturnType<typeof loadScriptText>; source: ScriptSource }>();

	/** An online script: fetched, checked as Search checks it, then saved and picked. */
	async function pickListing(listing: ScriptListing) {
		const target = listing.target;
		if (target.kind === 'edition') return finish(target.edition);
		busy = true;
		try {
			const data = await loadOfficialData();
			if (target.kind === 'saved') {
				const script = reloadSavedScript(target.saved, data);
				if (script) await save(script, target.saved.source);
				return;
			}
			const fetched = await targetText(target);
			const result = loadScriptText(relaxJson(fetched.text), data);
			if (!result.script || result.problems.some((p) => p.severity !== 'info')) {
				checking = { result, source: fetched.source };
				checkOpen = true;
			} else await save(result.script, fetched.source);
		} catch (e) {
			// A refused link or a missing script is expected; anything else is a bug worth logging.
			if (!(e instanceof ScriptFetchError)) reportError(e, { area: 'scripts', notify: false });
			toast(t('scripts.add.failed'), errorMessage(e));
		} finally {
			busy = false;
		}
	}
</script>

<BottomSheet bind:open title={t('modes.scriptSheet.title')} height="85dvh">
	{#snippet actions()}
		<IconButton icon="add" label={t('scripts.picker.add')} onclick={() => adder?.open()} />
	{/snippet}
	<div class="sheet" data-testid="script-sheet">
		<div class="find">
			<span class="where">
				<Select
					label={t('modes.scriptSheet.where')}
					hideLabel
					value={where}
					options={whereOptions}
					onChange={(v) => (where = v)}
				/>
			</span>
			<SearchField
				bind:value={term}
				label={t('modes.scriptSearch.label')}
				placeholder={t('modes.scriptSearch.placeholder')}
				testid="script-sheet-search"
			/>
		</div>
		{#if where === DEVICE}
			{#if deviceScripts.length === 0}
				<p class="none">{t('common.none')}</p>
			{/if}
			{#each GROUPS as group (group)}
				{@const rows = deviceScripts.filter((o) => o.group === group)}
				{#if rows.length > 0}
					<section aria-label={t(`modes.scriptSearch.${group}`)}>
						<h3>{t(`modes.scriptSearch.${group}`)}</h3>
						<ul class="rows">
							{#each rows as option (option.value)}
								<li>
									<button
										type="button"
										class="row"
										aria-pressed={option.value === value}
										onclick={() => finish(option.value)}
									>
										<ScriptName name={option.label}>
											{#snippet sub()}{[
													option.author
														? t('player.byAuthor', { author: option.author })
														: undefined,
													option.version
														? t('player.version', { version: option.version })
														: undefined
												]
													.filter(Boolean)
													.join(' · ')}{/snippet}
										</ScriptName>
									</button>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/each}
		{:else}
			{#key where}
				<OnlineScripts source={where} {term} disabled={busy} onpick={(l) => void pickListing(l)} />
			{/key}
		{/if}
	</div>
</BottomSheet>

<!-- Beside the sheet, so its dialogs stay open as the sheet closes on a pick. -->
<AddScript
	bind:this={adder}
	button={false}
	onsaved={() => {
		const saved = currentScript.saved;
		if (saved) finish(`recent:${saved.scriptId}`);
	}}
/>
<ScriptCheckDialog
	bind:open={checkOpen}
	result={checking?.result}
	onconfirm={() => {
		const loaded = checking?.result.script;
		if (loaded && checking) void save(loaded, checking.source);
	}}
/>

<style>
	.sheet {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-width: 0;
	}
	.find {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		min-width: 0;
	}
	.where {
		flex: 0 0 auto;
		width: calc(11 * var(--u));
		max-width: 50%;
	}
	.find > :global(:last-child) {
		flex: 1;
		min-width: 0;
	}
	h3 {
		margin: 0;
		padding-inline: var(--space-2);
		font-family: var(--font-control);
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	.rows {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 1px solid transparent; /* px-ok: hairline border */
		border-radius: var(--card-radius);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	.row:hover {
		background: var(--choice-background);
	}
	.row[aria-pressed='true'] {
		border-color: var(--choice-selected-border);
	}
	.row:focus-visible {
		outline: 3px solid var(--focus); /* px-ok: focus ring */
		outline-offset: -3px; /* px-ok: focus ring */
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
