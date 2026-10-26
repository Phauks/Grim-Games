<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
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
	 * bucket on the same IconButton as Print and Share beside it, for a header (Trevor,
	 * 2026-10-26: "should be the same as other buttons it is in the same line as").
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

<span class="sheet-background" class:compact data-testid="sheet-background">
	<Select
		label={t('player.sheetBackground')}
		hideLabel
		{labelledBy}
		value={playerSettings.current.sheetBackground}
		{options}
		icon={compact ? 'sheetBackground' : undefined}
		onChange={(sheetBackground) =>
			playerSettings.update({ sheetBackground: sheetBackground as SheetBackground })}
	>
		{#snippet selected(option)}
			<span class="choice">{@render swatch(option.value)}{option.label}</span>
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
	/* Beside Print and Share: its IconButton alone. */
	.compact {
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
