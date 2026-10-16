<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import SettingSegmented from '#lib/ui/settings/SettingSegmented.svelte';
	import type { Theme } from '#lib/ui/themes/types.ts';
	import {
		MIN_CONTRAST,
		TOKEN_COLOURS,
		TOKEN_SCALE_LABELS,
		TOKEN_SCALES,
		tokenColour,
		tokenContrast,
		type TokenAppearance,
		type TokenColour,
		type TokenScale
	} from '#lib/ui/token/token-appearance.ts';
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
	{#if sample}<CharacterToken character={sample} size={56} />{/if}
	<ReminderToken label={t('characters.previewReminder')} type="minion" />
</div>

<SettingSegmented
	label={t('characters.tokenSize')}
	description={t('characters.tokenSizeHelp')}
	value={String(value.tokenScale)}
	options={TOKEN_SCALES.map((scale) => ({
		value: String(scale),
		label: t(TOKEN_SCALE_LABELS[scale])
	}))}
	onChange={(scale) => onChange({ ...value, tokenScale: Number(scale) as TokenScale })}
/>
<SettingSegmented
	label={t('characters.reminderSize')}
	description={t('characters.reminderSizeHelp')}
	value={String(value.reminderScale)}
	options={TOKEN_SCALES.map((scale) => ({
		value: String(scale),
		label: t(TOKEN_SCALE_LABELS[scale])
	}))}
	onChange={(scale) => onChange({ ...value, reminderScale: Number(scale) as TokenScale })}
/>

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
		/* A fixed height that fits the XL token (56px × 1.5) and the XL chip at any Text size, so
		   changing a size never moves the settings below. */
		height: max(calc(56px * 1.5 + var(--space-2)), 3.3rem); /* px-ok: the sample token is 56px */
		white-space: nowrap;
		margin-bottom: var(--space-5);
		overflow: hidden;
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
