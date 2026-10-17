<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import type { Theme } from '#lib/ui/themes/types.ts';
	import {
		MIN_CONTRAST,
		TOKEN_COLOURS,
		TOKEN_SCALE,
		tokenColour,
		tokenContrast,
		type TokenAppearance,
		type TokenColour
	} from '#lib/ui/token/token-appearance.ts';
	import SettingPreview from '#lib/ui/settings/SettingPreview.svelte';
	import PlayerNameMark from '#lib/ui/token/PlayerNameMark.svelte';
	import CharacterToken from './CharacterToken.svelte';
	import { loadOfficialData, officialData } from './game-data.svelte.ts';
	import { sheetNumbersFor } from './sheet-night-numbers.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';

	interface Props {
		value: TokenAppearance;
		theme: Theme;
		onChange: (value: TokenAppearance) => void;
	}

	let { value, theme, onChange }: Props = $props();

	onMount(() => void loadOfficialData());
	const sample = $derived(officialData.current?.byId.get('fortuneteller'));
	// The sample's place on TPI's whole night sheet, counting characters only.
	const sampleNumbers = $derived.by(() => {
		const data = officialData.current;
		if (!data || !value.nightNumbers) return undefined;
		return sheetNumbersFor(data.nightSheet, 'fortuneteller');
	});
	const contrast = $derived(tokenContrast(value, theme));
	// The reminder as the board draws it, at the board's size for this token (GrimoireBoard:
	// half the token, kept between 30 and 48px, times Reminder size). Trevor, 2026-10-17: the
	// preview showed the inline chip, not the reminder token.
	const reminderSize = $derived(
		Math.round(Math.max(30, Math.min(48, 56 * value.tokenScale * 0.5)) * value.reminderScale)
	);

	function setColour(key: TokenColour, colour: string | undefined) {
		const colours = { ...value.colours };
		if (colour) colours[key] = colour;
		else delete colours[key];
		onChange({ ...value, colours });
	}

	const readable = (ratio: number) =>
		t(ratio >= MIN_CONTRAST ? 'characters.contrast.good' : 'characters.contrast.poor', {
			ratio: ratio.toFixed(1)
		});
</script>

<!-- The section's shared sticky preview (Trevor, 2026-10-17). Space for the largest sizes is
     kept, so changing a size never moves the settings below. -->
<SettingPreview testid="token-preview">
	<div class="preview" aria-hidden="true">
		{#if sample}<span class="disc"
				><CharacterToken
					character={sample}
					size={56}
					showName={value.boardNames}
					nightNumbers={sampleNumbers}
				/><PlayerNameMark name={t('characters.previewPlayer')} /></span
			>{/if}
		{#if sample}<BoardReminder
				label={sample.reminders[0] ?? t('characters.previewReminder')}
				character={sample}
				size={reminderSize}
				disabled
				onTap={() => {}}
			/>{/if}
	</div>
</SettingPreview>

<SettingSlider
	label={t('characters.tokenSize')}
	description={t('characters.tokenSizeHelp')}
	value={value.tokenScale}
	{...TOKEN_SCALE}
	defaultValue={1}
	onChange={(tokenScale) => onChange({ ...value, tokenScale })}
/>
<SettingSlider
	label={t('characters.reminderSize')}
	description={t('characters.reminderSizeHelp')}
	value={value.reminderScale}
	{...TOKEN_SCALE}
	defaultValue={1}
	onChange={(reminderScale) => onChange({ ...value, reminderScale })}
/>

<div class="names">
	<SettingToggle
		label={t('characters.boardNames')}
		description={t('characters.boardNamesHelp')}
		checked={value.boardNames}
		onChange={(boardNames) => onChange({ ...value, boardNames })}
	/>
	<SettingToggle
		label={t('characters.nightNumbers')}
		description={t('characters.nightNumbersHelp')}
		checked={value.nightNumbers}
		onChange={(nightNumbers) => onChange({ ...value, nightNumbers })}
	/>
	<!-- Always shown, so switching the badges on or off never moves the settings below. -->
	<SettingSlider
		label={t('characters.nightBadgeSize')}
		description={t('characters.nightBadgeSizeHelp')}
		value={value.nightBadgeScale}
		{...TOKEN_SCALE}
		defaultValue={1}
		onChange={(nightBadgeScale) => onChange({ ...value, nightBadgeScale })}
	/>
</div>

{#each TOKEN_COLOURS as colour (colour.key)}
	<SettingRow label={t(colour.label)} description={t(colour.description)}>
		{#snippet control(labelId)}
			<div class="colour">
				<input
					type="color"
					aria-labelledby={labelId}
					value={tokenColour(colour.key, value, theme)}
					onchange={(event) => setColour(colour.key, event.currentTarget.value)}
				/>
				<!-- Disabled, not hidden, when nothing changed: no reflow. -->
				<Button
					variant="quiet"
					aria-label={t('characters.colour.resetOne', { colour: t(colour.label) })}
					disabled={!value.colours[colour.key]}
					onclick={() => setColour(colour.key, undefined)}>{t('characters.colour.reset')}</Button
				>
			</div>
		{/snippet}
	</SettingRow>
{/each}

<dl class="contrast" data-testid="token-contrast">
	<dt>{t('characters.contrast.face')}</dt>
	<dd data-poor={contrast.face < MIN_CONTRAST || undefined}>{readable(contrast.face)}</dd>
	<dt>{t('characters.contrast.reminder')}</dt>
	<dd data-poor={contrast.reminder < MIN_CONTRAST || undefined}>{readable(contrast.reminder)}</dd>
</dl>

<style>
	.preview {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		/* A fixed height that fits the largest token (56px × 2) with the player name badge on its
		   rim, and the largest chip at any Text size, so changing a size never moves the settings
		   below. */
		--sample: 112px; /* px-ok: the sample token is 56px, at up to 200% */
		height: max(calc(1.1 * var(--sample)), 4.4rem);
		white-space: nowrap;
		overflow: hidden;
	}
	.disc {
		position: relative;
		display: inline-block;
		line-height: 0;
	}
	.names {
		margin: var(--space-5) 0;
	}
	.colour {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	input[type='color'] {
		width: calc(4 * var(--u));
		min-width: var(--tap-target);
		height: var(--tap-target);
		padding: calc(0.125 * var(--u));
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		cursor: pointer;
	}
	.contrast {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
		margin: var(--space-5) 0 0;
		font-size: 0.9rem;
	}
	.contrast dt {
		color: var(--on-surface-muted);
	}
	.contrast dd {
		margin: 0;
	}
	.contrast dd[data-poor] {
		color: var(--heading);
		font-weight: 600;
	}
</style>
