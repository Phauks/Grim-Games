<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import {
		SHEET_BACKGROUNDS,
		sheetSwatch,
		type SheetBackground
	} from '#lib/ui/themes/sheet-backgrounds.ts';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * The script and night order sheets' background, a drop-down of neutral colours (Trevor,
	 * 2026-10-24: "a color selector with several color options like grey, tan, and other neutral
	 * colors"). One setting for every sheet, also in Settings > Player. `compact` is a paint
	 * bucket drawn like the icon buttons beside it (Print, Share), for a header (Trevor,
	 * 2026-10-26: the swatch in a box "looks pretty out of place").
	 */
	interface Props {
		compact?: boolean;
		/** Id of a visible label elsewhere (Settings' row). */
		labelledBy?: string;
	}

	let { compact = false, labelledBy }: Props = $props();

	const options = $derived(
		SHEET_BACKGROUNDS.map((value) => ({ value, label: t(`player.sheetBackground.${value}`) }))
	);
</script>

{#snippet swatch(value: string)}
	<span class="swatch" style:background={sheetSwatch(value as SheetBackground)} aria-hidden="true"
	></span>
{/snippet}

<span
	class="sheet-background"
	class:compact
	title={compact ? t('player.sheetBackground') : undefined}
	data-testid="sheet-background"
>
	<Select
		label={t('player.sheetBackground')}
		hideLabel
		{labelledBy}
		value={playerSettings.current.sheetBackground}
		{options}
		listFitsTrigger={!compact}
		onChange={(sheetBackground) =>
			playerSettings.update({ sheetBackground: sheetBackground as SheetBackground })}
	>
		{#snippet selected(option)}
			{#if compact}<Icon name="sheetBackground" />{:else}
				<span class="choice">{@render swatch(option.value)}{option.label}</span>
			{/if}
		{/snippet}
		{#snippet item(option)}
			<span class="choice">{@render swatch(option.value)}{option.label}</span>
		{/snippet}
	</Select>
</span>

<style>
	.sheet-background {
		display: block;
		min-width: 0;
	}
	/* Beside Print and Share: an IconButton's look (IconButton.svelte), so the script's name
	   keeps its room (the list still opens below it). */
	.compact {
		flex: none;
		width: var(--tap-target);
	}
	.compact :global([data-scope='select'][data-part='trigger']) {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: none;
		color: var(--on-surface);
	}
	.compact :global([data-scope='select'][data-part='trigger']:active),
	.compact :global([data-scope='select'][data-part='trigger'][data-state='open']) {
		background: var(--surface-selected);
	}
	.compact :global([data-scope='select'][data-part='indicator']),
	.compact :global([data-scope='select'][data-part='label']) {
		display: none;
	}
	.compact :global(.value) {
		display: grid;
		flex: none;
	}
	.choice {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		vertical-align: middle;
	}
	.swatch {
		flex: none;
		width: 1.25em;
		height: 1.25em;
		border: var(--control-border);
		border-radius: 50%;
	}
</style>
