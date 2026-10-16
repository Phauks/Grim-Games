<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import SettingSegmented from '#lib/ui/settings/SettingSegmented.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import type { Theme } from '#lib/ui/themes/types.ts';
	import {
		DEFAULT_TOKEN_APPEARANCE,
		MIN_CONTRAST,
		TOKEN_COLOURS,
		TOKEN_SCALE,
		tokenColour,
		tokenContrast,
		type TokenAppearance,
		type TokenColour
	} from '#lib/ui/token/token-appearance.ts';
	import PlayerNameMark from '#lib/ui/token/PlayerNameMark.svelte';
	import CharacterToken from './CharacterToken.svelte';
	import { loadOfficialData, officialData } from './game-data.svelte.ts';
	import ReminderToken from './ReminderToken.svelte';

	interface Props {
		value: TokenAppearance;
		theme: Theme;
		onChange: (value: TokenAppearance) => void;
	}

	let { value, theme, onChange }: Props = $props();

	onMount(() => void loadOfficialData());
	const sample = $derived(officialData.current?.byId.get('fortuneteller'));
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

<!-- Space for the largest sizes is kept, so changing a size never moves the settings below. -->
<div class="preview" aria-hidden="true" data-testid="token-preview">
	{#if sample}<span class="seat">
			<span class="disc"
				><CharacterToken
					character={sample}
					size={56}
					showName={value.boardNames}
				/>{#if value.playerNamePlacement !== 'below'}<PlayerNameMark
						name={t('characters.previewPlayer')}
						placement={value.playerNamePlacement}
					/>{/if}</span
			>
			<!-- Kept in place (hidden) when the name is on the token: no reflow. -->
			<span class="player" class:hidden={value.playerNamePlacement !== 'below'}
				>{t('characters.previewPlayer')}</span
			>
		</span>{/if}
	<ReminderToken label={t('characters.previewReminder')} type="minion" />
</div>

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
	<SettingSegmented
		label={t('characters.playerNamePlacement')}
		description={t('characters.playerNamePlacementHelp')}
		value={value.playerNamePlacement}
		defaultValue={DEFAULT_TOKEN_APPEARANCE.playerNamePlacement}
		options={[
			{ value: 'below', label: t('characters.playerNamePlacement.below') },
			{ value: 'icon-top', label: t('characters.playerNamePlacement.iconTop') },
			{ value: 'icon-bottom', label: t('characters.playerNamePlacement.iconBottom') },
			{ value: 'badge', label: t('characters.playerNamePlacement.badge') }
		]}
		onChange={(playerNamePlacement) => onChange({ ...value, playerNamePlacement })}
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
		/* A fixed height that fits the largest token (56px × 2), the player name under it and the
		   largest chip at any Text size, so changing a size never moves the settings below. */
		--sample: 112px; /* px-ok: the sample token is 56px, at up to 200% */
		height: max(calc(var(--sample) + var(--space-2) + 1.6rem), 4.4rem);
		white-space: nowrap;
		margin-bottom: var(--space-5);
		overflow: hidden;
	}
	.seat {
		display: inline-grid;
		justify-items: center;
		gap: calc(0.125 * var(--u));
	}
	.disc {
		position: relative;
		display: inline-block;
		line-height: 0;
	}
	/* As the name under a seat on the board (SeatDisc). */
	.player {
		padding: 0.15em 0.5em;
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
		font-family: var(--font-player);
		font-size: 0.8rem;
		line-height: 1.2;
	}
	.player.hidden {
		visibility: hidden;
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
