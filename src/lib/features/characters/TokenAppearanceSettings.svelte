<script lang="ts">
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
		`${ratio.toFixed(1)}:1, ${ratio >= MIN_CONTRAST ? 'easy to read' : 'hard to read'}`;
</script>

<!-- Space for the largest sizes is kept, so changing a size never moves the settings below. -->
<div class="preview" aria-hidden="true" data-testid="token-preview">
	{#if sample}<CharacterToken character={sample} size={56} />{/if}
	<ReminderToken label="Poisoned" type="minion" />
</div>

<SettingSegmented
	label="Character token size"
	description="Character tokens on the board, reference cards and setup. Text size and Icon size stay the same."
	value={String(value.tokenScale)}
	options={TOKEN_SCALES.map((scale) => ({
		value: String(scale),
		label: TOKEN_SCALE_LABELS[scale]
	}))}
	onChange={(scale) => onChange({ ...value, tokenScale: Number(scale) as TokenScale })}
/>
<SettingSegmented
	label="Reminder token size"
	description="Reminder tokens wherever they show."
	value={String(value.reminderScale)}
	options={TOKEN_SCALES.map((scale) => ({
		value: String(scale),
		label: TOKEN_SCALE_LABELS[scale]
	}))}
	onChange={(scale) => onChange({ ...value, reminderScale: Number(scale) as TokenScale })}
/>

{#each TOKEN_COLOURS as colour (colour.key)}
	<SettingRow label={colour.label} description={colour.description}>
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
					aria-label="Reset {colour.label}"
					disabled={!value.colours[colour.key]}
					onclick={() => setColour(colour.key, undefined)}>Reset</Button
				>
			</div>
		{/snippet}
	</SettingRow>
{/each}

<dl class="contrast" data-testid="token-contrast">
	<dt>Text on tokens</dt>
	<dd data-poor={contrast.face < MIN_CONTRAST || undefined}>{readable(contrast.face)}</dd>
	<dt>Text on reminders</dt>
	<dd data-poor={contrast.reminder < MIN_CONTRAST || undefined}>{readable(contrast.reminder)}</dd>
</dl>

<style>
	.preview {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		/* A fixed height that fits the XL token (56px × 1.5) and the XL chip at any Text size, so
		   changing a size never moves the settings below. */
		height: max(calc(56px * 1.5 + var(--space-2)), 3.3rem);
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
		padding: 2px;
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
