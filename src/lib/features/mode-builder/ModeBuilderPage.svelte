<script lang="ts">
	import { onMount } from 'svelte';
	import {
		buildKindOf,
		buildParts,
		emptyFile,
		GAME_MODES,
		parseGameMode,
		parseSpecialRule,
		setAt,
		SPECIAL_RULES,
		topFields,
		type BuildKind,
		type GameMode,
		type SpecialRule
	} from '#lib/core/modes/index.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { customModes } from '#lib/features/modes/custom-modes.svelte.ts';
	import { customRules } from '#lib/features/modes/custom-rules.svelte.ts';
	import ModeInspectDialog from '#lib/features/modes/ModeInspectDialog.svelte';
	import ShareModeDialog from '#lib/features/modes/ShareModeDialog.svelte';
	import { modeFileText } from '#lib/features/modes/mode-share.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BuilderTools from '#lib/ui/builder/BuilderTools.svelte';
	import OpenSavedDialog from '#lib/ui/builder/OpenSavedDialog.svelte';
	import { fileNameFor } from '#lib/ui/download.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import BuilderField from './BuilderField.svelte';
	import BuilderPart from './BuilderPart.svelte';
	import { isEmptyDraft, modeDraft } from './draft.svelte.ts';

	/**
	 * Make a game mode or special rule without writing JSON (Trevor, 2026-10-31: "an interactive
	 * mode creator that automatically builds and updates depending upon the actual framework of
	 * the modes"). The whole form is drawn from the format guide (core/modes/builder.ts), so a
	 * part or field added to the format shows here by itself. The file is checked as it is
	 * edited, with the checker Add mode uses; Save keeps it with the modes and rules added on
	 * this device, where New game and Special rules list it, and Share sends it as a link.
	 */

	let known = $state.raw<ReadonlySet<CharacterId>>();
	onMount(() => {
		loadOfficialData()
			.then((data) => (known = new Set(data.characters.map((c) => c.id))))
			.catch((e) => reportError(e, { area: 'modes' }));
		openFromHash();
	});

	const draft = $derived(modeDraft.current);
	const file = $derived(draft.file);
	const kind = $derived(buildKindOf(file));
	const parts = $derived(buildParts(kind));
	const partsValue = $derived(
		typeof file.parts === 'object' && file.parts !== null
			? (file.parts as Record<string, unknown>)
			: {}
	);
	const parsed = $derived(
		kind === 'game-mode' ? parseGameMode(file, known) : parseSpecialRule(file, known)
	);
	const built = $derived<GameMode | SpecialRule | undefined>(
		parsed.ok ? ('mode' in parsed ? parsed.mode : parsed.rule) : undefined
	);
	const issues = $derived(parsed.ok ? [] : parsed.issues);
	const name = $derived(typeof file.name === 'string' && file.name ? file.name : t('common.none'));

	/** What it was opened from, if it is one of this device's own. */
	const savedOne = $derived<GameMode | SpecialRule | undefined>(
		draft.editing
			? (customModes.list.find((m) => m.id === draft.editing) ??
					customRules.list.find((r) => r.id === draft.editing))
			: undefined
	);
	const isSaved = $derived(!!savedOne && !!built && modeFileText(savedOne) === modeFileText(built));

	let openOpen = $state(false);
	let clearOpen = $state(false);
	let deleteOpen = $state(false);
	let problemsOpen = $state(false);
	let inspectOpen = $state(false);
	let shareOpen = $state(false);
	let replacing = $state.raw<GameMode | SpecialRule>();
	let replaceOpen = $state(false);
	let saveIssues = $state<string[]>([]);

	function set(path: readonly (string | number)[], value: unknown) {
		modeDraft.setFile(setAt(file, path, value) as Record<string, unknown>);
	}

	function changeKind(next: BuildKind) {
		if (next === kind) return;
		// The details and parts carry over; any a rule can't set are named by the checker.
		const rest = { ...file };
		delete rest.kind;
		delete rest.format;
		const fresh = emptyFile(next);
		modeDraft.setFile({
			...(fresh.kind ? { kind: fresh.kind } : {}),
			format: fresh.format,
			...rest
		});
	}

	function save(asNew = false) {
		if (!built) return;
		let value: GameMode | SpecialRule = built;
		if (asNew) {
			const ids = new Set([...customModes.list, ...customRules.list].map((m) => m.id));
			let n = 2;
			while (ids.has(`${built.id}-${n}`)) n++;
			value = { ...built, id: `${built.id}-${n}` };
		}
		const result =
			value.kind === 'special-rule'
				? customRules.add(value, known)
				: customModes.add(JSON.stringify(value), known);
		if (!result.ok) {
			saveIssues = result.issues;
			problemsOpen = true;
			return;
		}
		saveIssues = [];
		// The old copy goes when the id was changed on the builder.
		if (draft.editing && draft.editing !== value.id) removeSaved(draft.editing);
		modeDraft.replace({ file: { ...value } as Record<string, unknown>, editing: value.id });
	}

	function removeSaved(id: string) {
		customModes.remove(id);
		customRules.remove(id);
	}

	/** Every mode and rule: this device's own to edit, built-in ones to start a copy from. */
	const openable = $derived<(GameMode | SpecialRule)[]>([
		...customModes.list,
		...customRules.list,
		...GAME_MODES,
		...SPECIAL_RULES
	]);
	const isOwn = (m: GameMode | SpecialRule) =>
		customModes.list.includes(m as GameMode) || customRules.list.includes(m as SpecialRule);

	function choose(m: GameMode | SpecialRule) {
		openOpen = false;
		if (isEmptyDraft(draft)) openOne(m);
		else {
			replacing = m;
			replaceOpen = true;
		}
	}
	function openOne(m: GameMode | SpecialRule) {
		const copy = JSON.parse(modeFileText(m)) as Record<string, unknown>;
		if (isOwn(m)) modeDraft.replace({ file: copy, editing: m.id });
		else modeDraft.replace({ file: { ...copy, id: `${m.id}-copy` } });
	}

	/** `/build-mode#edit=<id>` opens one of this device's own (Special rules' and New game's Edit). */
	function openFromHash() {
		const id = new URLSearchParams(location.hash.slice(1)).get('edit');
		if (!id) return;
		history.replaceState(history.state, '', location.pathname);
		const own = [...customModes.list, ...customRules.list].find((m) => m.id === id);
		if (own && own.id !== draft.editing) choose(own);
	}
</script>

<svelte:window onhashchange={openFromHash} />

<Page title={t('modes.builder.heading')}>
	{#snippet actions()}
		<BuilderTools
			save={{
				ready: !!built,
				saved: isSaved,
				editing: !!savedOne,
				onSave: () => save(),
				onSaveNew: () => save(true)
			}}
			openLabel={t('modes.builder.open')}
			onOpen={() => (openOpen = true)}
			downloadLabel={t('modes.builder.download')}
			downloadDisabled={!built}
			json={built ?? file}
			fileName={fileNameFor(name, 'mode')}
			jsonTitle={name}
			clearLabel={savedOne ? t('modes.builder.delete') : t('modes.builder.clear')}
			clearDisabled={!savedOne && isEmptyDraft(draft)}
			onClear={() => (savedOne ? (deleteOpen = true) : (clearOpen = true))}
		>
			<!-- Shares what is saved, so the link always matches a file on this device. -->
			<IconButton
				icon="share"
				label={t('modes.shareFile', { name })}
				disabled={!isSaved}
				onclick={() => (shareOpen = true)}
			/>
		</BuilderTools>
	{/snippet}

	{#snippet side()}
		<div class="side">
			<Button variant="field" icon="warning" onclick={() => (problemsOpen = true)}>
				{t('modes.builder.problems')}
				<CountBadge count={issues.length} />
			</Button>
			<Button variant="field" icon="info" disabled={!built} onclick={() => (inspectOpen = true)}>
				{t('modes.builder.inspect')}
			</Button>
		</div>
	{/snippet}

	<ErrorBoundary area="modes">
		<div class="builder" data-testid="mode-builder">
			<PageSection title={t('modes.builder.details')}>
				<Select
					label={t('modes.builder.makes')}
					value={kind}
					options={(['game-mode', 'special-rule'] as const).map((k) => ({
						value: k,
						label: t(`modes.builder.makes.${k}`)
					}))}
					onChange={changeKind}
				/>
				{#each topFields(kind) as field (field.name)}
					<BuilderField
						{field}
						parent="file"
						value={file[field.name]}
						onChange={(v) => set([field.name], v)}
					/>
				{/each}
			</PageSection>
			<PageSection title={t('modes.builder.parts')}>
				<div class="parts">
					{#each parts as part (part.part)}
						<BuilderPart
							{part}
							value={partsValue[part.part]}
							onChange={(v) => set(['parts', part.part], v)}
						/>
					{/each}
				</div>
			</PageSection>
		</div>
	</ErrorBoundary>
</Page>

<Dialog bind:open={problemsOpen} title={t('modes.builder.problems')}>
	<ul class="problems" data-testid="mode-builder-problems">
		{#each [...saveIssues, ...issues.filter((i) => !saveIssues.includes(i))] as issue (issue)}
			<li>{issue}</li>
		{:else}
			<li class="muted">{t('common.none')}</li>
		{/each}
	</ul>
</Dialog>

{#if built}
	<ModeInspectDialog bind:open={inspectOpen} mode={built} />
{/if}
<ShareModeDialog bind:open={shareOpen} mode={isSaved ? savedOne : undefined} />

<OpenSavedDialog
	bind:open={openOpen}
	title={t('modes.builder.openTitle')}
	items={openable}
	key={(m) => `${m.kind ?? 'game-mode'}:${m.id}:${isOwn(m) ? 'own' : 'built-in'}`}
	onChoose={choose}
	search={{
		label: t('modes.builder.search'),
		matches: (m, words) => words.every((w) => m.name.toLocaleLowerCase().includes(w))
	}}
	testid="saved-modes"
>
	{#snippet row(m)}
		<span class="open-row">
			<span>{m.name}</span>
			<span class="muted"
				>{t(
					`modes.builder.makes.${m.kind === 'special-rule' ? 'special-rule' : 'game-mode'}`
				)}{isOwn(m) ? '' : ` · ${t('modes.builder.builtIn')}`}</span
			>
		</span>
	{/snippet}
</OpenSavedDialog>

<ConfirmDialog
	bind:open={replaceOpen}
	title={t('modes.builder.openReplace', { name: replacing?.name ?? '' })}
	danger
	onConfirm={() => replacing && openOne(replacing)}
>
	<p>{t('modes.builder.openReplaceBody')}</p>
</ConfirmDialog>

<ConfirmDialog
	bind:open={clearOpen}
	title={t('modes.builder.clearTitle')}
	danger
	onConfirm={() => modeDraft.clear(kind)}
/>

<ConfirmDialog
	bind:open={deleteOpen}
	title={t('modes.builder.deleteTitle', { name })}
	danger
	onConfirm={() => {
		if (draft.editing) removeSaved(draft.editing);
		modeDraft.setEditing(undefined);
	}}
/>

<style>
	.builder {
		display: grid;
		gap: var(--space-4);
	}
	.parts {
		display: grid;
	}
	/* Side by side, so they take one row above the form on a phone. */
	.side {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(calc(var(--u) * 10), 1fr));
		gap: var(--space-2);
	}
	.problems {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding-inline-start: var(--space-4);
	}
	.open-row {
		display: grid;
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
