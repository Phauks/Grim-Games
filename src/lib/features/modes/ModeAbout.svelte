<script lang="ts">
	import type { GameMode, SpecialRule } from '#lib/core/modes/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { shownAbout } from './own-wording.svelte.ts';
	import ModeValue from './ModeValue.svelte';

	/**
	 * A mode's About (Trevor, 2026-10-18: "an about section that describes each game mode ...
	 * information about authorship"): its description, authors and sources. One component for
	 * New game and the inspector. A built-in description waits for Trevor's approval (approved-about.ts); authors show
	 * only where a source names them. `compact` keeps each row but the description to one line.
	 */
	interface Props {
		/** A game mode or a special rule: both carry the same About. */
		mode: GameMode | SpecialRule;
		compact?: boolean;
	}

	let { mode, compact = false }: Props = $props();

	const description = $derived(shownAbout(mode));
</script>

<dl class="about" class:compact data-testid="mode-about">
	<div class="row">
		<dt>{t('modes.description')}</dt>
		<dd data-testid="inspect-about">{description ?? t('common.none')}</dd>
	</div>
	<div class="row">
		<dt>{t('modes.authors')}</dt>
		<dd data-testid="inspect-authors">
			{#each mode.authors ?? [] as author (author.title + author.url)}<span class="item"
					><ModeValue field="author" value={author} /></span
				>{:else}{t('common.none')}{/each}
		</dd>
	</div>
	<div class="row">
		<dt>{t('modes.sources')}</dt>
		<dd>
			{#each mode.sources as source (source.url)}<span class="item"
					><ModeValue field="source" value={source} /></span
				>{:else}{t('common.none')}{/each}
		</dd>
	</div>
	{#if !compact && mode.aliases?.length}
		<div class="row">
			<dt>{t('modes.aliases')}</dt>
			<dd>{mode.aliases.join(', ')}</dd>
		</div>
	{/if}
</dl>

<style>
	.about {
		display: grid;
		margin: 0;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(6rem, 1fr) minmax(0, 3fr);
		gap: var(--space-3);
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--border);
	}
	.row:last-child {
		border-bottom: 0;
	}
	.item + .item::before {
		content: ', ';
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		min-width: 0;
	}
	/* One line a row on New game, except the description, which wraps so it can be read
	   whole (Trevor, 2026-10-18); the inspector shows every line. */
	.compact dd:not([data-testid='inspect-about']) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
