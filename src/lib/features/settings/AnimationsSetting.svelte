<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { animationsOn } from '#lib/ui/animations.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES, type Animations } from '#lib/ui/preferences.ts';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';

	/**
	 * The one Animations setting (Trevor, 2026-11-16, option B): the full choice in Settings >
	 * Theme, and a switch in the app menu that every player, Storyteller and spectator can
	 * reach from any screen. The switch shows whether anything moves now; flipping it picks On
	 * or Off, and Match device is chosen again in Settings.
	 */
	let { variant }: { variant: 'setting' | 'switch' } = $props();

	const set = (animations: Animations) => preferences.update({ animations });
</script>

{#if variant === 'setting'}
	<SettingSelect
		label={t('settings.animations')}
		value={preferences.current.animations}
		defaultValue={DEFAULT_PREFERENCES.animations}
		options={[
			{ value: 'device', label: t('settings.animationsDevice') },
			{ value: 'on', label: t('settings.animationsOn') },
			{ value: 'off', label: t('settings.animationsOff') }
		]}
		onChange={set}
	/>
{:else}
	<div class="switch" data-testid="menu-animations">
		<Toggle
			label={t('settings.animations')}
			checked={animationsOn()}
			onChange={(on) => set(on ? 'on' : 'off')}
		/>
	</div>
{/if}

<style>
	/* In line with the menu buttons' icons and labels below it. */
	.switch {
		padding-inline: var(--space-3);
	}
</style>
