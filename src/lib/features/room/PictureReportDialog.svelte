<script lang="ts">
	import { roomImagePath } from '#lib/core/sync/room-images.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { roomHost } from './host.svelte.ts';

	/**
	 * A player's picture another phone reported (Trevor, 2026-10-27: "show the image to the
	 * storyteller, who can either decide to let it stand, or to remove/revoke avatar for that
	 * game"), over the board. One report at a time, oldest first. Removing it puts that player's
	 * initials back on their seat everywhere until the next game; letting it stand ends its
	 * reports. The X leaves it for later: it opens again once someone else reports it.
	 */
	const host = roomHost();
	/** Reports set aside with the X, by hash, at the count they had. */
	let later = $state<Record<string, number>>({});
	const report = $derived(host.pictureReports.find((r) => later[r.hash] !== r.count));
	const name = $derived(
		host.members.find((m) => m.memberId === report?.memberId)?.name ??
			t('room.pictureReport.someone')
	);

	// Opens with each report; the X closes it until that report changes.
	let open = $derived(!!report);

	function setOpen(isOpen: boolean) {
		open = isOpen;
		if (!isOpen && report) later = { ...later, [report.hash]: report.count };
	}

	function judge(allow: boolean) {
		if (!report) return;
		host.judgePicture(report.hash, allow);
	}
</script>

<Dialog bind:open={() => open, setOpen} title={t('room.pictureReport.title')}>
	{#if report && host.code}
		<div class="report" data-testid="picture-report">
			<img
				class="picture"
				src={roomImagePath(host.code, report.hash)}
				alt={t('room.pictureReport.picture', { name })}
			/>
			<p>{t('room.pictureReport.body', { name, count: report.count })}</p>
		</div>
	{/if}
	{#snippet actions()}
		<ModalActions
			onConfirm={() => judge(false)}
			danger
			confirmIcon="remove"
			confirmLabel={t('room.pictureReport.remove')}
		>
			{#snippet start()}<Button onclick={() => judge(true)}>{t('room.pictureReport.allow')}</Button
				>{/snippet}
		</ModalActions>
	{/snippet}
</Dialog>

<style>
	.report {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
	}
	.picture {
		width: calc(12 * var(--u));
		max-width: 100%;
		aspect-ratio: 1;
		border-radius: 50%;
		object-fit: cover;
		background: var(--surface-raised);
	}
	p {
		margin: 0;
		text-align: center;
	}
</style>
