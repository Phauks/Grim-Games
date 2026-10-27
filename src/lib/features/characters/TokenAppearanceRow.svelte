<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import {
		DEFAULT_TOKEN_APPEARANCE,
		type TokenAppearance
	} from '#lib/ui/token/token-appearance.ts';
	import { TOKEN_APPEARANCE_ROWS, type TokenAppearanceRowKey } from './token-appearance-rows.ts';

	/**
	 * One size or switch of the token look, drawn the same in Settings > Tokens and in the
	 * player's own settings (Trevor, 2026-10-27).
	 */
	interface Props {
		key: TokenAppearanceRowKey;
		value: TokenAppearance;
		onChange: (value: TokenAppearance) => void;
		/** Shown but unusable while its effect is off (no reflow). */
		disabled?: boolean;
	}

	let { key, value, onChange, disabled = false }: Props = $props();

	const row = $derived(TOKEN_APPEARANCE_ROWS[key]);
	const current = $derived(value[key]);
</script>

{#if typeof current === 'boolean'}
	<SettingToggle
		label={t(row.label)}
		description={t(`${row.label}Help`)}
		checked={current}
		{disabled}
		onChange={(checked) => onChange({ ...value, [key]: checked })}
	/>
{:else if 'range' in row}
	<SettingSlider
		label={t(row.label)}
		description={t(`${row.label}Help`)}
		value={current}
		{...row.range}
		defaultValue={DEFAULT_TOKEN_APPEARANCE[key] as number}
		{disabled}
		onChange={(size) => onChange({ ...value, [key]: size })}
	/>
{/if}
