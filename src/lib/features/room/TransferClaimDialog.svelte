<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import type { TransferDetails } from '#lib/core/sync/room.ts';
	import { TRANSFER_CODE_LENGTH } from '#lib/core/sync/room-transfer.ts';
	import { phaseText } from '#lib/features/grimoire/phase-text.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CodeField from '#lib/ui/primitives/CodeField.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { RoomClaim } from './room-transfer.svelte.ts';

	/**
	 * Room transfer, the side taking over (Trevor, 2026-10-28): on Join game, with the room code
	 * typed, ⋯ > Room transfer asks for the transfer code the Storyteller's device shows. Once
	 * it is right, it says who hands over what; Take over asks the Storyteller's device, and
	 * once it allows it, this device is the Storyteller and opens the game that came along, or
	 * New game.
	 */
	interface Props {
		open: boolean;
		roomCode: string;
	}

	let { open = $bindable(), roomCode }: Props = $props();

	let code = $state('');
	let claim = $state.raw<RoomClaim>();
	$effect(() => {
		if (!open) return;
		const next = new RoomClaim(roomCode);
		claim = next;
		code = '';
		return () => next.stop();
	});
	$effect(() => claim?.check(code));

	function what(details: TransferDetails): string {
		const players = t('common.players', { count: details.players });
		if (!details.game) return t('room.transfer.newGame', { players });
		const phase = details.game.phase;
		if (!phase || phase.kind === 'setup') return t('room.transfer.gameSetup', { players });
		const kind = phase.kind === 'night' ? 'night' : 'day';
		return t('room.transfer.game', { players, phase: phaseText({ kind, number: phase.number }) });
	}

	async function take() {
		if (!claim) return;
		try {
			const gameId = await claim.take();
			open = false;
			await goto(gameId ? resolve('/grimoire/[gameId]', { gameId }) : resolve('/new'));
		} catch {
			// A turned-down or refused ask says so on the status line.
			if (!claim.problem) toast(t('room.transfer.takeFailed'));
		}
	}

	const problem = $derived(claim?.problem);
	const details = $derived(claim?.details);
</script>

<Dialog bind:open title={t('room.transfer.title')}>
	<form
		class="claim"
		data-testid="transfer-claim"
		onsubmit={(event) => {
			event.preventDefault();
			void take();
		}}
	>
		<label for="transfer-code">{t('room.transfer.code')}</label>
		<CodeField
			id="transfer-code"
			bind:value={code}
			length={TRANSFER_CODE_LENGTH}
			group={TRANSFER_CODE_LENGTH / 2}
			centred
		/>
		<!-- One line, always in its place: who hands over what, or why the code was turned down. -->
		<p class="status" role="status" data-testid="transfer-status">
			{#if claim?.taking}
				{t('room.transfer.waiting')}
			{:else if problem?.kind === 'denied'}
				{t('room.transfer.denied')}
			{:else if details}
				{#if details.storyteller}{t('room.transfer.from')}
					<PlayerBadge name={details.storyteller as PlayerName} />:
				{/if}{what(details)}
			{:else if problem?.kind === 'wrong'}
				{t('room.transfer.wrong', { count: problem.triesLeft })}
			{:else if problem}
				{t('room.transfer.none')}
			{/if}
		</p>
		<!-- The match check (Trevor, 2026-10-31): the Storyteller's Allow prompt shows the same
		     number for this device only. In its place before it is asked, so nothing moves. -->
		<div class="check" data-testid="transfer-check" class:waiting={!claim?.taking}>
			<span>{t('room.transfer.check')}</span>
			<strong>{claim?.taking && claim.matchCheck ? claim.matchCheck : '····'}</strong>
		</div>
		<ModalActions
			onCancel={() => (open = false)}
			submit
			disabled={!details || claim?.taking}
			confirmLabel={t('room.transfer.take')}
		/>
	</form>
</Dialog>

<style>
	.claim {
		display: grid;
		gap: var(--space-3);
	}
	.claim label {
		font-size: 1.1rem;
	}
	.status {
		margin: 0;
		min-height: 3em;
	}
	.check {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.check strong {
		font-family: var(--font-heading);
		font-size: 2rem;
		letter-spacing: 0.08em;
		font-variant-numeric: tabular-nums;
	}
	.check.waiting {
		color: var(--on-surface-muted);
	}
</style>
