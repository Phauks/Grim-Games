<script lang="ts">
	import { AVATAR_IDS, type AvatarId } from '#lib/core/avatars/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import SettingSelect from './SettingSelect.svelte';

	/**
	 * The player's avatar (plan R6), picked from a drop-down with each picture drawn beside its
	 * name: in Settings and where a player joins a room, the same control.
	 */
	interface Props {
		value: AvatarId | undefined;
		onChange: (value: AvatarId | undefined) => void;
		testid?: string;
	}

	let { value, onChange, testid }: Props = $props();

	/** The choice for no avatar, which shows the seat's number. */
	const NONE = 'none';
	const options = [
		{ value: NONE, label: t('player.avatar.none') },
		...AVATAR_IDS.map((id) => ({ value: id, label: t(`player.avatar.${id}`) }))
	];
</script>

{#snippet swatch(option: { value: string; label: string })}
	<span class="option">
		<span class="swatch" class:empty={option.value === NONE}
			>{#if option.value !== NONE}<AvatarFace avatar={option.value as AvatarId} />{/if}</span
		>
		{option.label}
	</span>
{/snippet}

<div class="avatar-setting" data-testid={testid}>
	<SettingSelect
		label={t('player.avatar')}
		value={value ?? NONE}
		{options}
		defaultValue={NONE}
		onChange={(v) => onChange(v === NONE ? undefined : (v as AvatarId))}
		item={swatch}
		selected={swatch}
	/>
</div>

<style>
	.option {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.swatch {
		flex: none;
		width: 1.75em;
		height: 1.75em;
	}
	.empty {
		box-sizing: border-box;
		border-radius: 50%;
		border: 2px dashed var(--border); /* px-ok: the empty seat's own dashed edge */
	}
</style>
