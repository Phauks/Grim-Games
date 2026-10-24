<script lang="ts">
	import type { AvatarId } from '#lib/core/avatars/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingToggle from './SettingToggle.svelte';

	/**
	 * The player's avatar (plan R6): for now their initials on their seat, or the seat's
	 * number (Trevor, 2026-10-23: "Initials for now"). In Settings and where a player joins a
	 * room, the same control. Two states, so a switch; a drawn set would make it a drop-down.
	 */
	interface Props {
		value: AvatarId | undefined;
		onChange: (value: AvatarId | undefined) => void;
		testid?: string;
	}

	let { value, onChange, testid }: Props = $props();
</script>

<div class="avatar-setting" data-setting data-testid={testid}>
	<SettingToggle
		label={t('player.avatar')}
		checked={value === 'initials'}
		onChange={(on) => onChange(on ? 'initials' : undefined)}
	/>
</div>
