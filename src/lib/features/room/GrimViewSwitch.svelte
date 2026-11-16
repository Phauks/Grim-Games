<script lang="ts">
	import type { ShareChoices } from '#lib/core/engine/index.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';
	import ShareChoicesFields from './ShareChoicesFields.svelte';

	/**
	 * Grim view for one person (Trevor, 2026-11-16, option A: "share grim from Players like Give
	 * a seat", in place of a password): on, after asking what else goes with the grimoire, the
	 * whole grimoire reaches their phone, live; off, it stops. What's shared changes what goes,
	 * at once, for everyone with Grim view (2026-11-16, option B: "allow for letting more or less").
	 */
	interface Props {
		memberId: string;
		name: PlayerName;
		disabled?: boolean;
	}

	let { memberId, name, disabled = false }: Props = $props();

	const host = roomHost();
	let asking = $state(false);
	let changing = $state(false);
	let choices = $state.raw<ShareChoices>(host.grimChoices);
	const on = $derived(host.grimViewers.includes(memberId));
</script>

<div data-testid="grim-view">
	<SettingToggle
		label={t('room.watch.title')}
		description={on && host.grimoireTooLarge ? t('room.watch.tooLarge') : t('room.watch.hint')}
		checked={on}
		{disabled}
		onChange={(next) => {
			if (!next) host.setGrimView(memberId, false);
			else {
				choices = host.grimChoices;
				asking = true;
			}
		}}
	/>
	<Button disabled={disabled || !on} onclick={() => (changing = true)} data-testid="whats-shared"
		>{t('room.watch.whatsShared')}</Button
	>
</div>

<Dialog bind:open={changing} title={t('room.watch.liveTitle')}>
	<p class="dialog-text">{t('room.watch.liveBody')}</p>
	<ShareChoicesFields bind:choices={() => host.grimChoices, (next) => host.setGrimChoices(next)} />
</Dialog>

<ConfirmDialog
	bind:open={asking}
	title={t('room.watch.askTitle')}
	onConfirm={() => host.setGrimView(memberId, true, choices)}
>
	<PlayerBadge {name} />
	<p class="dialog-text">{t('room.watch.askBody')}</p>
	<ShareChoicesFields bind:choices />
</ConfirmDialog>

<style>
	.dialog-text {
		margin: 0;
	}
</style>
