<script lang="ts">
	import {
		GAME_MODE_FORMAT,
		GAME_MODE_REVISION,
		GUIDE_INTRO,
		GUIDE_PARTS,
		GUIDE_TOP,
		MINIMAL_EXAMPLE,
		RULE_GUIDE_INTRO,
		RULE_GUIDE_PARTS,
		RULE_GUIDE_TOP,
		gameModeById,
		type GuideField
	} from '#lib/core/modes/index.ts';
	import { tick } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ContentsLayout, { type ContentsItem } from '#lib/ui/layout/ContentsLayout.svelte';
	import { downloadFile } from '#lib/ui/download.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import FileView from '#lib/ui/primitives/FileView.svelte';
	import { guideText, type GuideFormat } from './guide-export.ts';
	import { modeLabel } from './labels.ts';

	/**
	 * How to write a mode file, drawn from the format's own guide (core/modes/format-guide.ts),
	 * which a test keeps in step with the format (Trevor, 2026-10-18). App documentation, so
	 * it shows whatever the own-wording setting.
	 */
	interface Props {
		open?: boolean;
		/**
		 * Where it opens: a section (`top`, `rule-top`, `part:<name>`) and, in it, the field to
		 * scroll to (Trevor, 2026-11-01: each Mode builder setting links "to the specific part
		 * of the mode creation guide").
		 */
		at?: { section: string; field?: string };
	}

	let { open = $bindable(false), at }: Props = $props();

	const full = JSON.stringify(gameModeById('whale-buffet'), null, 2);

	const items: ContentsItem[] = [
		{ id: 'overview', label: t('modes.guide.overview') },
		{ id: 'top', label: t('modes.guide.top') },
		...GUIDE_PARTS.map((p) => ({ id: `part:${p.part}`, label: modeLabel('part', p.part) })),
		{ id: 'full', label: t('modes.guide.full') },
		// A special rule's own header and parts; the mode parts it may set are written as above.
		{ id: 'rule-top', label: t('modes.guide.ruleTop') },
		...RULE_GUIDE_PARTS.map((p) => ({ id: `part:${p.part}`, label: modeLabel('part', p.part) }))
	];
	// Opens on the overview; on a phone, Back shows the list of sections.
	let current = $state<string | undefined>('overview');
	const part = $derived(
		[...GUIDE_PARTS, ...RULE_GUIDE_PARTS].find((p) => `part:${p.part}` === current)
	);

	let body = $state<HTMLElement>();
	/** Opened at a setting: that section, scrolled to the field's row, which is outlined. */
	$effect(() => {
		if (!open || !at) return;
		const { section, field } = at;
		current = section;
		if (!field) return;
		void tick().then(() => {
			const row = body?.querySelector<HTMLElement>(`[data-guide-field="${CSS.escape(field)}"]`);
			row?.scrollIntoView({ block: 'center' });
		});
	});

	let choosing = $state(false);
	let downloadAnchor = $state<HTMLElement>();
	function save(format: GuideFormat) {
		choosing = false;
		downloadFile(
			`writing-a-mode-file.${format}`,
			guideText(format),
			format === 'md' ? 'text/markdown' : 'text/plain'
		);
	}
	const minimal = JSON.stringify(MINIMAL_EXAMPLE, null, 2);
</script>

{#snippet fields(list: GuideField[])}
	{#if list.length > 0}
		<!-- A table, field by field (Trevor, 2026-10-18: rows were hard to parse). -->
		<table class="fields">
			<tbody>
				{#each list as f (f.name)}
					<tr data-guide-field={f.name} data-target={at?.field === f.name ? '' : undefined}>
						<th scope="row">
							<code>{f.name}</code>
							<span class="muted">
								{f.type} · {f.required ? t('modes.guide.required') : t('modes.guide.optional')}
							</span>
						</th>
						<td>
							{f.about}
							{#if f.values}
								<span class="values">
									{t('modes.guide.values')}
									{#each f.values as v, i (v)}<code>{v}</code>{i < f.values.length - 1
											? ', '
											: ''}{/each}
								</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
{/snippet}

<Dialog bind:open title={t('modes.guide.title')} size="full">
	{#snippet headActions()}
		<span bind:this={downloadAnchor}>
			<IconButton
				icon="download"
				label={t('modes.guide.download')}
				onclick={() => (choosing = !choosing)}
			/>
		</span>
	{/snippet}
	<!-- Sections listed on the left, the chosen one on the right (Trevor, 2026-10-18: "a two
		section modal"); on a phone the list comes first and a section slides in over it. -->
	<ContentsLayout
		label={t('modes.guide.sections')}
		{items}
		{current}
		onSelect={(id) => (current = id)}
		home={current === undefined}
		paneAtHome={false}
		backLabel={t('modes.guide.sections')}
		onBack={() => (current = undefined)}
	>
		<div class="guide" data-testid="mode-guide" bind:this={body}>
			{#if current === 'overview'}
				<h3>{t('modes.guide.overview')}</h3>
				<p data-testid="mode-guide-version">
					{t('modes.guide.version', { format: GAME_MODE_FORMAT, revision: GAME_MODE_REVISION })}
				</p>
				{#each GUIDE_INTRO as line (line)}<p>{line}</p>{/each}
				<FileView
					title={t('modes.guide.example')}
					text={minimal}
					fileName="{MINIMAL_EXAMPLE.id}.json"
					copyLabel={t('modes.copyFile')}
					downloadLabel={t('modes.downloadFile')}
				/>
			{:else if current === 'top'}
				<h3>{t('modes.guide.top')}</h3>
				{@render fields(GUIDE_TOP)}
			{:else if current === 'full'}
				<h3>{t('modes.guide.full')}</h3>
				<FileView
					title={t('modes.guide.full')}
					text={full}
					fileName="whale-buffet.json"
					copyLabel={t('modes.copyFile')}
					downloadLabel={t('modes.downloadFile')}
				/>
			{:else if current === 'rule-top'}
				<h3>{t('modes.guide.ruleTop')}</h3>
				{#each RULE_GUIDE_INTRO as line (line)}<p>{line}</p>{/each}
				{@render fields(RULE_GUIDE_TOP)}
			{:else if part}
				<section class="part" data-part={part.part}>
					<h3>{modeLabel('part', part.part)} <code>{part.part}</code></h3>
					<p>
						{part.about}
						<span class="muted">{part.list ? t('modes.guide.list') : t('modes.guide.object')}</span>
					</p>
					<p class="muted">{t('modes.guide.cite')}</p>
					{@render fields(part.fields)}
					{#each part.kinds as k (k.kind)}
						<h4><code>"kind": "{k.kind}"</code></h4>
						<p>{k.about}</p>
						{@render fields(k.fields)}
					{/each}
				</section>
			{/if}
		</div>
	</ContentsLayout>
</Dialog>
<Popover bind:open={choosing} title={t('modes.guide.download')} anchor={downloadAnchor}>
	<div class="formats">
		<Button icon="download" onclick={() => save('md')}>{t('modes.guide.downloadMd')}</Button>
		<Button icon="download" onclick={() => save('txt')}>{t('modes.guide.downloadTxt')}</Button>
	</div>
</Popover>

<style>
	.guide {
		display: grid;
		align-content: start;
		gap: var(--space-2);
	}
	.formats {
		display: grid;
		gap: var(--space-1);
	}
	p,
	h3,
	h4 {
		margin: 0;
	}
	h3 {
		margin-top: var(--space-3);
		font-size: 1.1rem;
	}
	h4 {
		font-size: 1rem;
	}
	.part {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-sm);
	}
	.fields {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}
	.fields th,
	.fields td {
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--border);
		text-align: start;
		vertical-align: top;
		overflow-wrap: anywhere;
	}
	.fields tr[data-target] > * {
		background: var(--accent-wash);
	}
	.fields th {
		width: 35%;
		font-weight: normal;
	}
	.fields th .muted {
		display: block;
		font-size: 0.9em;
	}
	.values {
		display: block;
	}
	code {
		overflow-wrap: anywhere;
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
