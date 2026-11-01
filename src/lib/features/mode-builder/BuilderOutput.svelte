<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		jsonChunks,
		runsPart,
		splitIssue,
		type BuildKind,
		type CombinedParts,
		type GuidePart,
		type ModePart,
		type RulePart
	} from '#lib/core/modes/index.ts';
	import ModeValue from '#lib/features/modes/ModeValue.svelte';
	import { modeLabel } from '#lib/features/modes/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';

	/**
	 * The Mode builder's output, beside its settings (Trevor, 2026-11-01: "On the right, it
	 * should show the output ... the json output, additionally, as just a version of the output
	 * so you don't have to search through it. Allow clicking the items in the right area to move
	 * to those settings"). Problems are always listed ("problems shouldn't be hidden in a
	 * button"), then a readable summary (Inspect's `ModeValue`), then the JSON; a problem, a
	 * summary entry or a part's JSON lines jump to that setting.
	 */
	interface Props {
		kind: BuildKind;
		file: Record<string, unknown>;
		parts: readonly GuidePart[];
		/** The checker's problems, and Save's when it refused. */
		issues: readonly string[];
		/** Jumps to the setting at this path (`name`, `parts.pool.count`). */
		onJump: (path: string) => void;
		/** Buttons at the top (Inspect, Request feature). */
		actions?: Snippet;
	}

	let { kind, file, parts, issues, onJump, actions }: Props = $props();

	const partsValue = $derived(
		typeof file.parts === 'object' && file.parts !== null && !Array.isArray(file.parts)
			? (file.parts as Record<string, unknown>)
			: {}
	);
	const shown = $derived(parts.filter((p) => partsValue[p.part] !== undefined));
	const name = $derived(typeof file.name === 'string' && file.name ? file.name : undefined);
	const id = $derived(typeof file.id === 'string' ? file.id : '');
	const chunks = $derived(jsonChunks(file));

	/** Who runs a part as the file sets it, as Inspect says. */
	function status(part: string): 'modes.status.runs' | 'modes.status.storyteller' {
		try {
			return runsPart({ parts: partsValue as CombinedParts }, part as ModePart | RulePart)
				? 'modes.status.runs'
				: 'modes.status.storyteller';
		} catch {
			// A part not yet in a shape the app reads is the Storyteller's until it is.
			return 'modes.status.storyteller';
		}
	}
</script>

<div class="output" data-testid="mode-builder-output">
	{#if actions}<div class="actions">{@render actions()}</div>{/if}

	<section class="block" aria-labelledby="builder-problems">
		<h2 id="builder-problems">
			{t('modes.builder.problems')}
			<CountBadge count={issues.length} warn={issues.length > 0} />
		</h2>
		<ul class="list" data-testid="mode-builder-problems">
			{#each issues as issue (issue)}
				{@const at = splitIssue(issue)}
				<li>
					<button type="button" class="problem" onclick={() => onJump(at.path)}>
						<Icon name="warning" />
						<span>
							{#if at.path}<code>{at.path}</code>{/if}
							{at.message}
						</span>
					</button>
				</li>
			{:else}
				<li class="muted">{t('common.none')}</li>
			{/each}
		</ul>
	</section>

	<section class="block" aria-labelledby="builder-summary">
		<h2 id="builder-summary">{t('modes.builder.summary')}</h2>
		<ul class="list" data-testid="mode-builder-summary">
			<li>
				<button type="button" class="entry" onclick={() => onJump('id')}>
					<span class="key">{t(`modes.builder.makes.${kind}`)}</span>
					<span>{name ?? t('common.none')} <code>{id}</code></span>
				</button>
			</li>
			{#each shown as p (p.part)}
				<li data-summary={p.part}>
					<button type="button" class="entry" onclick={() => onJump(`parts.${p.part}`)}>
						<span class="key">
							{modeLabel('part', p.part)}
							<small>{t(status(p.part))}</small>
						</span>
						<span class="value"><ModeValue field={p.part} value={partsValue[p.part]} /></span>
					</button>
				</li>
			{/each}
		</ul>
	</section>

	<section class="block" aria-labelledby="builder-json">
		<h2 id="builder-json">{t('modes.builder.jsonOut')}</h2>
		<pre
			class="json"
			data-testid="mode-builder-json">{#each chunks as c, i (i)}{#if c.part}{@const at =
						c.part}<button
						type="button"
						class="chunk"
						aria-label={t('modes.builder.jumpTo', { part: modeLabel('part', at) })}
						onclick={() => onJump(`parts.${at}`)}>{c.text}</button
					>{:else}<span>{c.text}</span>{/if}{/each}</pre>
	</section>
</div>

<style>
	.output {
		display: grid;
		align-content: start;
		gap: var(--space-3);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.actions > :global(*) {
		flex: 1 1 calc(var(--u) * 10);
	}
	.block {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-2);
		border: 1px solid var(--border); /* px-ok: hairline */
		border-radius: var(--radius-sm);
		background: var(--panel-background);
		min-width: 0;
	}
	h2 {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		font-size: 1rem;
		letter-spacing: normal;
	}
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.list li + li {
		border-top: 1px solid var(--border); /* px-ok: hairline */
	}
	.problem,
	.entry {
		display: flex;
		width: 100%;
		gap: var(--space-2);
		padding: var(--space-1) 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.problem {
		align-items: baseline;
	}
	.problem :global(svg) {
		flex: none;
		color: var(--accent);
	}
	.entry {
		flex-direction: column;
		gap: 0;
	}
	.key {
		font-weight: 700;
	}
	small {
		color: var(--on-surface-muted);
		font-weight: 400;
	}
	.value {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	code {
		color: var(--on-surface-muted);
		font-size: 0.85em;
		overflow-wrap: anywhere;
	}
	.muted {
		color: var(--on-surface-muted);
	}
	.json {
		max-height: 60dvh;
		margin: 0;
		overflow: auto;
		font-family: var(--font-code);
		font-size: 0.8rem;
		line-height: 1.45;
		white-space: pre;
	}
	.chunk {
		display: inline;
		min-height: 0;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		white-space: pre;
		cursor: pointer;
	}
	.chunk:hover,
	.chunk:focus-visible {
		background: var(--accent-wash);
	}
</style>
