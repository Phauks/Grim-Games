<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		buildParts,
		closestPath,
		fileKind,
		GAME_MODES,
		parseModeOrRule,
		setAt,
		splitIssue,
		SPECIAL_RULES,
		topFields,
		wholeGamePartsOf,
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
	import { reportDialog } from '#lib/features/reports/report-dialog.svelte.ts';
	import { REPORT_LIMITS } from '#lib/features/reports/reports-protocol.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BuilderTools from '#lib/ui/builder/BuilderTools.svelte';
	import OpenSavedDialog from '#lib/ui/builder/OpenSavedDialog.svelte';
	import { fileNameFor } from '#lib/ui/download.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import ModeFormatGuide from '#lib/features/modes/ModeFormatGuide.svelte';
	import BuilderField from './BuilderField.svelte';
	import BuilderOutput from './BuilderOutput.svelte';
	import BuilderPart from './BuilderPart.svelte';
	import BuilderTable from './BuilderTable.svelte';
	import type { GuideAt } from './guide-at.ts';
	import { isEmptyDraft, modeDraft } from './draft.svelte.ts';

	/**
	 * Make a game mode or special rule without writing JSON (Trevor, 2026-10-31: "an interactive
	 * mode creator that automatically builds and updates depending upon the actual framework of
	 * the modes"). Both are one format, and the file's parts say which it is (Trevor, 2026-11-01:
	 * "One format, auto-labelled"), so there is nothing to pick. The whole form is drawn from the format guide (core/modes/builder.ts), so a
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
	const kind = $derived(fileKind(file));
	const groups = buildParts();
	const parts = [...groups.any, ...groups.wholeGame];
	const partsValue = $derived(
		typeof file.parts === 'object' && file.parts !== null
			? (file.parts as Record<string, unknown>)
			: {}
	);
	const parsed = $derived(parseModeOrRule(file, known));
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
	let inspectOpen = $state(false);
	let shareOpen = $state(false);
	let replacing = $state.raw<GameMode | SpecialRule>();
	let replaceOpen = $state(false);
	let saveIssues = $state<string[]>([]);

	/** Save's own problems first, then the checker's. */
	const shownIssues = $derived([...saveIssues, ...issues.filter((i) => !saveIssues.includes(i))]);
	function problemsIn(part: string) {
		const at = `parts.${part}`;
		return shownIssues.filter((i) => {
			const { path } = splitIssue(i);
			return path === at || path.startsWith(`${at}.`) || path.startsWith(`${at}[`);
		}).length;
	}

	let tab = $state<'settings' | 'output'>('settings');
	let settingsEl = $state<HTMLElement>();
	let flashTimer: ReturnType<typeof setTimeout> | undefined;
	/**
	 * From the output to the setting it is about (Trevor, 2026-11-01: "Allow clicking the items
	 * in the right area to move to those settings fast in the left side"): the nearest row or
	 * table holding that path, scrolled to, outlined for a moment and focused.
	 */
	async function jump(path: string) {
		tab = 'settings';
		await tick();
		const root = settingsEl;
		if (!root) return;
		const places = [...root.querySelectorAll<HTMLElement>('[data-path]')];
		const target =
			closestPath(
				path || 'id',
				places.map((el) => el.dataset.path ?? '')
			) ?? 'id';
		const el = places.find((p) => p.dataset.path === target);
		if (!el) return;
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		el.querySelector<HTMLElement>('input, textarea, button, [role="combobox"]')?.focus({
			preventScroll: true
		});
		root.querySelectorAll('[data-flash]').forEach((f) => f.removeAttribute('data-flash'));
		el.setAttribute('data-flash', '');
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => el.removeAttribute('data-flash'), 1500);
	}

	let guideOpen = $state(false);
	let guideAt = $state<GuideAt>();
	function guide(at: GuideAt) {
		guideAt = at;
		guideOpen = true;
	}

	function set(path: readonly (string | number)[], value: unknown) {
		modeDraft.setFile(setAt(file, path, value) as Record<string, unknown>);
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
			tab = 'output';
			return;
		}
		saveIssues = [];
		// The old copy goes when the id was changed on the builder, or when it changed kind, so
		// it moves between this device's modes and rules.
		if (draft.editing === value.id)
			(value.kind === 'special-rule' ? customModes : customRules).remove(value.id);
		else if (draft.editing) removeSaved(draft.editing);
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

	/**
	 * Ask for something the format can't say yet (Trevor, 2026-11-01: "a button on the mode
	 * creation screen that allows you to submit a bug report to add certain mode functionality").
	 * Opens the one Report form as an enhancement request, with what is on the builder as its
	 * details so the request shows what was being made; the person can leave them out.
	 */
	function requestFeature() {
		const text = isEmptyDraft(draft) ? '' : JSON.stringify(file, null, 2);
		reportDialog.show({
			kind: 'enhancement',
			title: `${t('modes.builder.heading')}: `,
			details: text && text.length <= REPORT_LIMITS.details ? text : undefined
		});
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

	<ErrorBoundary area="modes">
		<!-- Settings on the left, output on the right (Trevor picked layout B, 2026-11-01); on a
		     phone, Settings and Output tabs. All in the coding font, with no small caps. -->
		<div class="builder code-font" data-testid="mode-builder" data-tab={tab}>
			<div class="tabs">
				<Tabs
					bind:value={tab}
					label={t('modes.builder.heading')}
					tabs={[
						{ value: 'settings', label: t('modes.builder.settings') },
						{
							value: 'output',
							label: shownIssues.length
								? t('modes.builder.outputProblems', { count: shownIssues.length })
								: t('modes.builder.output')
						}
					]}
				>
					{#snippet panel()}{/snippet}
				</Tabs>
			</div>
			<div class="cols">
				<div class="settings" bind:this={settingsEl}>
					<BuilderTable path="details">
						{#snippet head()}{t('modes.builder.details')}{/snippet}
						{#each topFields() as field (field.name)}
							<BuilderField
								{field}
								parent="file"
								path={field.name}
								value={file[field.name]}
								onChange={(v) => set([field.name], v)}
								onGuide={() => guide({ section: 'top', field: field.name })}
							/>
						{/each}
					</BuilderTable>
					{#each [{ key: 'any', list: groups.any }, { key: 'wholeGame', list: groups.wholeGame }] as const as group (group.key)}
						<h2 class="group" data-testid="mode-builder-group-{group.key}">
							{t(`modes.builder.parts.${group.key}`)}
						</h2>
						{#each group.list as part (part.part)}
							<BuilderPart
								{part}
								value={partsValue[part.part]}
								problems={problemsIn(part.part)}
								onChange={(v) => set(['parts', part.part], v)}
								onGuide={guide}
							/>
						{/each}
					{/each}
				</div>
				<aside class="output" aria-label={t('modes.builder.output')}>
					<BuilderOutput
						{kind}
						because={wholeGamePartsOf(file)}
						{file}
						{parts}
						issues={shownIssues}
						onJump={jump}
					>
						{#snippet actions()}
							<Button
								variant="field"
								icon="info"
								disabled={!built}
								onclick={() => (inspectOpen = true)}
							>
								{t('modes.builder.inspect')}
							</Button>
							<Button variant="field" icon="report" onclick={requestFeature}>
								{t('modes.builder.request')}
							</Button>
						{/snippet}
					</BuilderOutput>
				</aside>
			</div>
		</div>
	</ErrorBoundary>
</Page>

<ModeFormatGuide bind:open={guideOpen} at={guideAt} />

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
	onConfirm={() => modeDraft.clear()}
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
		container: builder-page / inline-size;
		font-size: 0.9rem;
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: var(--space-4);
		align-items: start;
	}
	.settings {
		container: builder / inline-size;
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	/* The output stays in view while the settings scroll. */
	.output {
		position: sticky;
		top: var(--space-3);
		max-height: calc(100dvh - var(--space-6));
		overflow-y: auto;
		min-width: 0;
	}
	.tabs {
		display: none;
	}
	/* Narrow: one column at a time, chosen by the tabs. */
	@container builder-page (max-width: 48rem) {
		.tabs {
			display: block;
			margin-bottom: var(--space-2);
		}
		.cols {
			grid-template-columns: minmax(0, 1fr);
		}
		.output {
			position: static;
			max-height: none;
		}
		[data-tab='settings'] .output,
		[data-tab='output'] .settings {
			display: none;
		}
	}
	/* Outlined for a moment where the output jumped to. */
	.settings :global([data-flash]),
	.settings :global(tr[data-flash] > *) {
		outline: 2px solid var(--accent); /* px-ok: focus ring */
		outline-offset: -2px; /* px-ok: focus ring */
	}
	.group {
		margin: var(--space-2) 0 0;
		font-size: 1rem;
	}
	.open-row {
		display: grid;
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
