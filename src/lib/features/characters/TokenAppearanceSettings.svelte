<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
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
		TOKEN_SCALE,
		tokenColour,
		tokenContrast,
		type TokenAppearance,
		type TokenColour
	} from '#lib/ui/token/token-appearance.ts';
	import SettingGroup from '#lib/ui/settings/SettingGroup.svelte';
	import CharacterBadge from './CharacterBadge.svelte';
	import TokenAppearanceRow from './TokenAppearanceRow.svelte';
	import NameSizeSlider from '#lib/features/grimoire/NameSizeSlider.svelte';
	import ReminderToken from './ReminderToken.svelte';
	import type { Snippet } from 'svelte';
	import PlayerNameMark from '#lib/ui/token/PlayerNameMark.svelte';
	import CharacterToken from './CharacterToken.svelte';
	import { loadOfficialData, officialData } from './game-data.svelte.ts';
	import { sheetNumbersFor } from './sheet-night-numbers.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import type { ReminderLabel } from '#lib/core/data/index.ts';
	import { boardTokenSize } from '#lib/ui/seating/last-board.svelte.ts';
	import {
		boardLooks,
		DEFAULT_BOARD_LOOKS,
		NAME_OFFSET
	} from '#lib/features/grimoire/board-looks.svelte.ts';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';

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

	onMount(() => void loadOfficialData());
	// A character with every marking, so each leaf setting shows (Trevor, 2026-10-19: "a setup,
	// reminder token, and operate in both types of nights"): the Godfather. "Died Today" is
	// also long enough to show the reminder word settings.
	const SAMPLE_ID = 'godfather';
	const sample = $derived(officialData.current?.byId.get(SAMPLE_ID));
	// Long words, so Reminder words width and Wrap long reminder words show (Trevor,
	// 2026-10-22: every setting shows in its preview).
	const REMINDER_SAMPLE_ID = 'devilsadvocate';
	const reminderSample = $derived(officialData.current?.byId.get(REMINDER_SAMPLE_ID));
	// The sample as the only character in play (Trevor, 2026-10-17: "a low number (1) (1),
	// not absolute"): 1 on each night it wakes.
	const sampleNumbers = $derived.by(() => {
		const data = officialData.current;
		if (!data || value.nightLeaves !== 'numbers') return undefined;
		const { first, other } = sheetNumbersFor(data.nightSheet, SAMPLE_ID);
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
	{#snippet preview()}
		<!-- As it rests, then highlighted as a held seat's reminder (Trevor, 2026-10-20). Its
		     player has turned good, so its owner's icon is good's (Trevor, 2026-10-23). Then an ∞
		     token with an icon symbol. -->
		<div class="preview reminder-sample" style:--sample="{largestReminder}px">
			{#if reminderSample}<BoardReminder
					label={reminderSample.reminders[0]}
					character={reminderSample}
					alignment="good"
					size={reminderSize}
					disabled
					onTap={() => {}}
				/><span class="lit" data-testid="lit-reminder-sample"
					><BoardReminder
						label={reminderSample.reminders[0]}
						character={reminderSample}
						alignment="good"
						size={reminderSize}
						disabled
						onTap={() => {}}
					/></span
				><BoardReminder
					label={'' as ReminderLabel}
					character={undefined}
					infinite
					symbol="ph:star"
					size={reminderSize}
					disabled
					onTap={() => {}}
				/>{/if}
		</div>
	{/snippet}
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
	{#snippet preview()}
		<!-- A line of text with a name and a reminder. The badge is the one design used
		     everywhere, in lists too (Trevor, 2026-10-20). -->
		<div class="preview in-text">
			<p class="line">
				{#if sample}<CharacterBadge
						characterId={sample.id}
						character={sample}
						interactive={false}
					/>
					{t('characters.inTextPlaces')}
					<ReminderToken
						label={sample.reminders[0] ?? t('characters.previewReminder')}
						character={sample}
					/>
					{t('characters.inTextOn', { player: t('characters.previewPlayer') })}{/if}
			</p>
		</div>
	{/snippet}
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
	/* Room under the largest token for the player name at its largest size and distance
	   (Trevor, 2026-10-20), so neither slider moves the settings or hides the name. */
	.token-sample {
		align-items: flex-start;
		height: max(calc(1.45 * var(--sample)), 4.4rem);
	}
	.reminder-sample {
		height: max(var(--sample), 3rem);
	}
	/* Wide, the box beside the settings is too narrow for the reminders side by side at their
	   largest, so they stack: at rest, highlighted, then the ∞ token. */
	@container (min-width: 26rem) {
		.reminder-sample {
			flex-direction: column;
			height: max(calc(3 * var(--sample) + 2 * var(--space-4)), 9rem);
		}
	}
	/* The board's highlight on a held seat's reminders (GrimoireBoard .chip-slot.lit). */
	.lit {
		display: contents;
	}
	.lit > :global(.reminder) {
		outline: var(--reminder-lit-ring, 0.2rem solid var(--accent));
		outline-offset: 0.15rem;
		filter: var(--reminder-lit-glow, none);
	}
	/*
	 * Narrow, the box sits above its settings, so it keeps room for every size at its largest
	 * (no reflow), measured at phone width. Wide, it sits beside them, so it fits what it shows
	 * (Trevor, 2026-10-19: the box was far bigger than its sample).
	 */
	.in-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: var(--space-2);
		height: 8.5rem;
		white-space: normal;
	}
	@container (min-width: 26rem) {
		.in-text {
			height: auto;
		}
	}
	.in-text .line {
		margin: 0;
		line-height: 2.2;
	}
	.disc {
		/* Drawn at the board's size, which already includes Token size (as SeatToken). */
		position: relative;
		display: inline-block;
		line-height: 0;
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
