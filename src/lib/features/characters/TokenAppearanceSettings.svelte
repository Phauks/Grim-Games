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
		REMINDER_LABEL_WIDTH,
		TOKEN_COLOURS,
		TOKEN_SCALE,
		tokenColour,
		tokenContrast,
		type TokenAppearance,
		type TokenColour
	} from '#lib/ui/token/token-appearance.ts';
	import SettingGroup from '#lib/ui/settings/SettingGroup.svelte';
	import CharacterBadge from './CharacterBadge.svelte';
	import ReminderToken from './ReminderToken.svelte';
	import type { Snippet } from 'svelte';
	import PlayerNameMark from '#lib/ui/token/PlayerNameMark.svelte';
	import CharacterToken from './CharacterToken.svelte';
	import { loadOfficialData, officialData } from './game-data.svelte.ts';
	import { sheetNumbersFor } from './sheet-night-numbers.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import { boardTokenSize } from '#lib/ui/seating/last-board.svelte.ts';
	import { boardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';

	interface Props {
		value: TokenAppearance;
		theme: Theme;
		onChange: (value: TokenAppearance) => void;
		/** More settings for names and reminders in text, shown in that group's box. */
		inText?: Snippet;
		/** The Character names font, first in the character token's box. */
		characterFont?: Snippet;
		/** The Reminder tokens font, first in the reminder token's box. */
		reminderFont?: Snippet;
	}

	let { value, theme, onChange, inText, characterFont, reminderFont }: Props = $props();

	onMount(() => void loadOfficialData());
	const sample = $derived(officialData.current?.byId.get('fortuneteller'));
	// The sample as the only character in play (Trevor, 2026-10-17: "a low number (1) (1),
	// not absolute"): 1 on each night it wakes.
	const sampleNumbers = $derived.by(() => {
		const data = officialData.current;
		if (!data || !value.nightNumbers) return undefined;
		const { first, other } = sheetNumbersFor(data.nightSheet, 'fortuneteller');
		return { first: first && 1, other: other && 1 };
	});
	const contrast = $derived(tokenContrast(value, theme));
	// The token at the size the board draws it (Trevor, 2026-10-17: the preview didn't match
	// the size in play): the last board's size, or a ten-player board filling the window.
	const viewport = $derived({ width: innerWidth.current ?? 0, height: innerHeight.current ?? 0 });
	const tokenSize = $derived(boardTokenSize(value.tokenScale, viewport));
	// Room for the largest Token size, so moving the slider never moves the settings below.
	const largest = $derived(boardTokenSize(TOKEN_SCALE.max, viewport));
	// The reminder as the board draws it, at the board's size for this token (GrimoireBoard:
	// half the token, kept between 30 and 48px, times Reminder size). Trevor, 2026-10-17: the
	// preview showed the inline chip, not the reminder token.
	const reminderSize = $derived(
		Math.round(Math.max(30, Math.min(48, tokenSize * 0.5)) * value.reminderScale)
	);

	const largestReminder = $derived(
		Math.round(Math.max(30, Math.min(48, largest * 0.5)) * TOKEN_SCALE.max)
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

<!-- One box per kind of token, each with its own preview (Trevor, 2026-10-18). Space for the
     largest sizes is kept in each preview, so changing a size never moves the settings. -->
<SettingGroup title={t('characters.group.token')} testid="token-preview">
	{#snippet preview()}
		<div class="preview token-sample" style:--sample="{largest}px">
			{#if sample}<span
					class="disc"
					style:--name-scale={boardLooks.current.nameSize}
					style:--name-offset={boardLooks.current.nameOffset}
					><CharacterToken
						character={sample}
						size={tokenSize}
						showName={value.boardNames}
						nightNumbers={sampleNumbers}
					/><PlayerNameMark name={t('characters.previewPlayer')} /></span
				>{/if}
		</div>
	{/snippet}
	{@render characterFont?.()}
	<SettingSlider
		label={t('characters.tokenSize')}
		description={t('characters.tokenSizeHelp')}
		value={value.tokenScale}
		{...TOKEN_SCALE}
		defaultValue={1}
		onChange={(tokenScale) => onChange({ ...value, tokenScale })}
	/>
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
	{@render colourRow(TOKEN_COLOURS[0])}
	{@render colourRow(TOKEN_COLOURS[2])}
	{@render contrastRow('characters.contrast.face', contrast.face)}
</SettingGroup>

<SettingGroup title={t('characters.group.reminder')} testid="reminder-preview">
	{#snippet preview()}
		<div class="preview reminder-sample" style:--sample="{largestReminder}px">
			{#if sample}<BoardReminder
					label={sample.reminders[0] ?? t('characters.previewReminder')}
					character={sample}
					size={reminderSize}
					disabled
					onTap={() => {}}
				/>{/if}
		</div>
	{/snippet}
	{@render reminderFont?.()}
	<SettingSlider
		label={t('characters.reminderSize')}
		description={t('characters.reminderSizeHelp')}
		value={value.reminderScale}
		{...TOKEN_SCALE}
		defaultValue={1}
		onChange={(reminderScale) => onChange({ ...value, reminderScale })}
	/>
	<SettingSlider
		label={t('characters.reminderLabelWidth')}
		description={t('characters.reminderLabelWidthHelp')}
		value={value.reminderLabelWidth}
		{...REMINDER_LABEL_WIDTH}
		defaultValue={1.5}
		onChange={(reminderLabelWidth) => onChange({ ...value, reminderLabelWidth })}
	/>
	<SettingToggle
		label={t('characters.reminderLabelWrap')}
		description={t('characters.reminderLabelWrapHelp')}
		checked={value.reminderLabelWrap}
		onChange={(reminderLabelWrap) => onChange({ ...value, reminderLabelWrap })}
	/>
	{@render colourRow(TOKEN_COLOURS[1])}
	{@render contrastRow('characters.contrast.reminder', contrast.reminder)}
</SettingGroup>

<!-- Reminders and character names inside lines of text (Trevor, 2026-10-18: "add the settings
     for in-line reminder tokens"). -->
<SettingGroup title={t('characters.group.inText')} testid="in-text-preview">
	{#snippet preview()}
		<p class="preview in-text">
			{#if sample}<CharacterBadge
					characterId={sample.id}
					character={sample}
					inline
					interactive={false}
				/>
				{t('characters.inTextPlaces')}
				<ReminderToken
					label={sample.reminders[0] ?? t('characters.previewReminder')}
					character={sample}
				/>
				{t('characters.inTextOn', { player: t('characters.previewPlayer') })}{/if}
		</p>
	{/snippet}
	{@render inText?.()}
	<SettingSlider
		label={t('characters.inlineReminderSize')}
		description={t('characters.inlineReminderSizeHelp')}
		value={value.inlineReminderScale}
		{...TOKEN_SCALE}
		defaultValue={1}
		onChange={(inlineReminderScale) => onChange({ ...value, inlineReminderScale })}
	/>
	<SettingToggle
		label={t('characters.inlineReminderIcons')}
		description={t('characters.inlineReminderIconsHelp')}
		checked={value.inlineReminderIcons}
		onChange={(inlineReminderIcons) => onChange({ ...value, inlineReminderIcons })}
	/>
</SettingGroup>

{#snippet colourRow(colour: (typeof TOKEN_COLOURS)[number])}
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
{/snippet}

{#snippet contrastRow(
	label: 'characters.contrast.face' | 'characters.contrast.reminder',
	ratio: number
)}
	<dl class="contrast" data-testid="token-contrast">
		<dt>{t(label)}</dt>
		<dd data-poor={ratio < MIN_CONTRAST || undefined}>{readable(ratio)}</dd>
	</dl>
{/snippet}

<style>
	.preview {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		/* A fixed height that fits the largest token (--sample, set above) with the player name
		   badge on its rim, and the largest chip at any Text size, so changing a size never moves
		   the settings below. */
		height: max(calc(1.1 * var(--sample)), 4.4rem);
		white-space: nowrap;
		overflow: hidden;
	}
	.reminder-sample {
		height: max(var(--sample), 3rem);
	}
	/* Room for the largest chip and badge at any Text size: no reflow. */
	.in-text {
		display: block;
		height: auto;
		min-height: 5.5rem;
		margin: 0;
		white-space: normal;
		line-height: 2.2;
	}
	.disc {
		/* Drawn at the board's size, which already includes Token size (as SeatToken). */
		--token-scale: 1;
		position: relative;
		display: inline-block;
		line-height: 0;
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
