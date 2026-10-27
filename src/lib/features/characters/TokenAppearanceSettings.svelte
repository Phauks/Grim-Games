<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import type { Theme } from '#lib/ui/themes/types.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import {
		MIN_CONTRAST,
		NIGHT_LEAVES,
		REMINDER_HIGHLIGHT_LOOKS,
		TOKEN_COLOURS,
		tokenColour,
		tokenContrast,
		type TokenAppearance,
		type TokenColour
	} from '#lib/ui/token/token-appearance.ts';
	import SettingGroup from '#lib/ui/settings/SettingGroup.svelte';
	import TokenAppearanceRow from './TokenAppearanceRow.svelte';
	import TokenAppearancePreview from './TokenAppearancePreview.svelte';
	import NameSizeSlider from '#lib/features/grimoire/NameSizeSlider.svelte';
	import type { Snippet } from 'svelte';
	import {
		boardLooks,
		DEFAULT_BOARD_LOOKS,
		NAME_OFFSET
	} from '#lib/features/grimoire/board-looks.svelte.ts';

	interface Props {
		value: TokenAppearance;
		theme: Theme;
		onChange: (value: TokenAppearance) => void;
		/** The Character names font, first in the character token's box. */
		characterFont?: Snippet;
		/** The Reminder tokens font, first in the reminder token's box. */
		reminderFont?: Snippet;
		/** The Player names font, with the player name badge's other settings. */
		playerFont?: Snippet;
	}

	let { value, theme, onChange, characterFont, reminderFont, playerFont }: Props = $props();

	const contrast = $derived(tokenContrast(value, theme));

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
	{#snippet preview()}<TokenAppearancePreview kind="token" {value} />{/snippet}
	<TokenAppearanceRow key="tokenScale" {value} {onChange} />
	<TokenAppearanceRow key="tokenIconScale" {value} {onChange} />
	<TokenAppearanceRow key="boardNames" {value} {onChange} />
	<!-- The side leaves and their night order numbers, one setting (Trevor, 2026-10-22). -->
	<SettingRow label={t('characters.nightLeaves')} description={t('characters.nightLeavesHelp')}>
		{#snippet control(labelId)}<Select
				label={t('characters.nightLeaves')}
				labelledBy={labelId}
				value={value.nightLeaves}
				options={NIGHT_LEAVES.map((leaves) => ({
					value: leaves,
					label: t(`characters.nightLeaves.${leaves}`)
				}))}
				onChange={(nightLeaves) => onChange({ ...value, nightLeaves })}
			/>{/snippet}
	</SettingRow>
	<!-- Always shown, so switching the badges on or off never moves the settings below;
	     disabled while they are off. -->
	<TokenAppearanceRow
		key="nightBadgeScale"
		{value}
		{onChange}
		disabled={value.nightLeaves !== 'numbers'}
	/>
	<SettingToggle
		label={t('characters.reminderLeaves')}
		description={t('characters.reminderLeavesHelp')}
		checked={value.reminderLeaves}
		onChange={(reminderLeaves) => onChange({ ...value, reminderLeaves })}
	/>
	<SettingToggle
		label={t('characters.setupFlower')}
		description={t('characters.setupFlowerHelp')}
		checked={value.setupFlower}
		onChange={(setupFlower) => onChange({ ...value, setupFlower })}
	/>
	<!-- Always shown, disabled without the flower, so switching it never moves the settings below. -->
	<SettingToggle
		label={t('characters.setupMovesName')}
		description={t('characters.setupMovesNameHelp')}
		checked={value.setupMovesName}
		disabled={!value.setupFlower}
		onChange={(setupMovesName) => onChange({ ...value, setupMovesName })}
	/>
	<!-- The player name badge under each seat's token (Trevor, 2026-10-20: "player name badges
	     should have settings in tokens under character tokens"), shown on the preview's token. -->
	{@render playerFont?.()}
	<NameSizeSlider />
	<!-- Clear of the character's name on the token (Trevor, 2026-10-18). -->
	<SettingSlider
		label={t('settings.nameOffset')}
		value={boardLooks.current.nameOffset}
		{...NAME_OFFSET}
		defaultValue={DEFAULT_BOARD_LOOKS.nameOffset}
		format={(offset) => intl.number(offset, { style: 'percent' })}
		onChange={(nameOffset) => boardLooks.update({ nameOffset })}
	/>
	{@render colourRow('face')}
	{@render colourRow('rim')}
	{@render colourRow('ink')}
	{@render contrastRow('characters.contrast.face', contrast.face)}
</SettingGroup>

<SettingGroup title={t('characters.group.reminder')} testid="reminder-preview">
	{#snippet preview()}<TokenAppearancePreview kind="reminder" {value} />{/snippet}
	{@render reminderFont?.()}
	<TokenAppearanceRow key="reminderScale" {value} {onChange} />
	<TokenAppearanceRow key="reminderIconScale" {value} {onChange} />
	<TokenAppearanceRow key="reminderLabelWidth" {value} {onChange} />
	<TokenAppearanceRow key="reminderLabelWrap" {value} {onChange} />
	<!-- Reminder glow and owner's icon (Trevor, 2026-10-20). The drop-downs stay in place,
	     disabled while their switch is off, so nothing below moves. -->
	<SettingToggle
		label={t('characters.reminderHighlight')}
		description={t('characters.reminderHighlightHelp')}
		checked={value.reminderHighlight}
		onChange={(reminderHighlight) => onChange({ ...value, reminderHighlight })}
	/>
	<SettingRow label={t('characters.reminderHighlightLook')}>
		{#snippet control(labelId)}<Select
				label={t('characters.reminderHighlightLook')}
				labelledBy={labelId}
				value={value.reminderHighlightLook}
				disabled={!value.reminderHighlight}
				options={REMINDER_HIGHLIGHT_LOOKS.map((look) => ({
					value: look,
					label: t(`characters.highlightLook.${look}`)
				}))}
				onChange={(reminderHighlightLook) => onChange({ ...value, reminderHighlightLook })}
			/>{/snippet}
	</SettingRow>
	{@render colourRow('reminder')}
	{@render colourRow('reminderLabel')}
	{@render colourRow('reminderInk')}
	{@render contrastRow('characters.contrast.reminder', contrast.reminder)}
</SettingGroup>

<!-- Reminders and character names inside lines of text (Trevor, 2026-10-18: "add the settings
     for in-line reminder tokens"). -->
<SettingGroup title={t('characters.group.inText')} testid="in-text-preview">
	{#snippet preview()}<TokenAppearancePreview kind="inText" {value} />{/snippet}
	<!-- Here, not under Character token: the names in this line always show the font, while
	     names on tokens are a switch (Trevor, 2026-10-22: every setting shows in its preview). -->
	{@render characterFont?.()}
	<!-- Text, icon and badge sizes for each, none shared (Trevor, 2026-10-18). -->
	<TokenAppearanceRow key="inlineNameTextScale" {value} {onChange} />
	<TokenAppearanceRow key="inlineNameIconScale" {value} {onChange} />
	<TokenAppearanceRow key="inlineNameBadgeScale" {value} {onChange} />
	<TokenAppearanceRow key="inlineReminderScale" {value} {onChange} />
	<TokenAppearanceRow key="inlineReminderIconScale" {value} {onChange} />
	<TokenAppearanceRow key="inlineReminderBadgeScale" {value} {onChange} />
</SettingGroup>

{#snippet colourRow(key: TokenColour)}
	{@const colour = TOKEN_COLOURS.find((c) => c.key === key)!}
	<!-- The reset beside the name, as every other setting (Trevor, 2026-10-24); disabled, not
	     hidden, while nothing changed: no reflow. -->
	<SettingRow
		label={t(colour.label)}
		description={t(colour.description)}
		onReset={() => setColour(colour.key, undefined)}
		isDefault={!value.colours[colour.key]}
	>
		{#snippet control(labelId)}
			<input
				type="color"
				aria-labelledby={labelId}
				value={tokenColour(colour.key, value, theme)}
				onchange={(event) => setColour(colour.key, event.currentTarget.value)}
			/>
		{/snippet}
	</SettingRow>
{/snippet}

{#snippet contrastRow(
	label: 'characters.contrast.face' | 'characters.contrast.reminder',
	ratio: number
)}
	<dl class="contrast" data-setting data-testid="token-contrast">
		<dt>{t(label)}</dt>
		<dd data-poor={ratio < MIN_CONTRAST || undefined}>{readable(ratio)}</dd>
	</dl>
{/snippet}

<style>
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
		margin: 0;
		padding-block: var(--space-3);
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
