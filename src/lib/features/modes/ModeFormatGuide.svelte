<script lang="ts">
	import {
		GAME_MODE_FORMAT,
		GAME_MODE_REVISION,
		GUIDE_INTRO,
		GUIDE_PARTS,
		GUIDE_TOP,
		MINIMAL_EXAMPLE,
		gameModeById,
		type GuideField
	} from '#lib/core/modes/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import FileView from '#lib/ui/primitives/FileView.svelte';
	import { modeLabel } from './labels.ts';

	/**
	 * How to write a mode file, drawn from the format's own guide (core/modes/format-guide.ts),
	 * which a test keeps in step with the format (Trevor, 2026-10-18). App documentation, so
	 * it shows whatever the own-wording setting.
	 */
	interface Props {
		open?: boolean;
	}

	let { open = $bindable(false) }: Props = $props();

	const full = JSON.stringify(gameModeById('whale-buffet'), null, 2);
	const minimal = JSON.stringify(MINIMAL_EXAMPLE, null, 2);
</script>

{#snippet fields(list: GuideField[])}
	{#if list.length > 0}
		<!-- A table, field by field (Trevor, 2026-10-18: rows were hard to parse). -->
		<table class="fields">
			<tbody>
				{#each list as f (f.name)}
					<tr>
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
	<div class="guide" data-testid="mode-guide">
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

		<h3>{t('modes.guide.top')}</h3>
		{@render fields(GUIDE_TOP)}

		<h3>{t('modes.guide.parts')}</h3>
		<p>{t('modes.guide.cite')}</p>
		{#each GUIDE_PARTS as p (p.part)}
			<section class="part" data-part={p.part}>
				<h4>{modeLabel('part', p.part)} <code>{p.part}</code></h4>
				<p>
					{p.about}
					<span class="muted">{p.list ? t('modes.guide.list') : t('modes.guide.object')}</span>
				</p>
				{@render fields(p.fields)}
				{#each p.kinds as k (k.kind)}
					<h5><code>"kind": "{k.kind}"</code></h5>
					<p>{k.about}</p>
					{@render fields(k.fields)}
				{/each}
			</section>
		{/each}

		<FileView
			title={t('modes.guide.full')}
			text={full}
			fileName="whale-buffet.json"
			copyLabel={t('modes.copyFile')}
			downloadLabel={t('modes.downloadFile')}
		/>
	</div>
</Dialog>

<style>
	.guide {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
	p,
	h3,
	h4,
	h5 {
		margin: 0;
	}
	h3 {
		margin-top: var(--space-3);
		font-size: 1.1rem;
	}
	h4 {
		font-size: 1rem;
	}
	h5 {
		font-size: 0.95rem;
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
