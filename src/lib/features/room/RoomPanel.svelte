<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { resolve } from '$app/paths';
	import { seatsInOrder, type SeatId } from '#lib/core/model/index.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import type { RoomMember, RoomRequest } from '#lib/core/sync/room.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import QrCode from '#lib/ui/primitives/QrCode.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { roomHost } from './host.svelte.ts';

	interface Props {
		game: OpenGame;
	}

	let { game }: Props = $props();

	const host = roomHost();
	$effect(() => host.attach(game));

	let closeOpen = $state(false);
	/** The seat chosen for each request, when the Storyteller picks a different one. */
	let chosen = $state<Record<string, SeatId | ''>>({});

	const seats = $derived(seatsInOrder(game.game));
	const seatLabel = (seatId?: SeatId) => {
		const i = seats.findIndex((s) => s.seatId === seatId);
		if (i < 0) return t('room.noSeat');
		const name = seats[i].playerName;
		return name
			? t('room.seatWithName', { number: i + 1, name })
			: t('common.seat', { number: i + 1 });
	};
	const seatNumberLabel = (seatId?: SeatId) => {
		const i = seats.findIndex((s) => s.seatId === seatId);
		return i < 0 ? t('room.noSeat') : t('common.seat', { number: i + 1 });
	};
	const seatOptions = $derived([
		{ value: '' as SeatId | '', label: t('room.noSeat') },
		...seats.map((s) => ({ value: s.seatId as SeatId | '', label: seatLabel(s.seatId) }))
	]);
	const link = $derived(
		host.code ? `${location.origin}${resolve('/join/[code]', { code: host.code })}` : ''
	);
	const connected = $derived(host.status === 'open');
	const seated = $derived(host.members.filter((m) => m.name !== undefined));
	const statusText = $derived(
		!host.code
			? host.problem
				? t('room.openFailed')
				: host.opening
					? t('room.openingRoom')
					: ''
			: host.refusedReason === 'too-old'
				? t('room.tooOld')
				: host.status === 'open'
					? t('room.connected')
					: host.status === 'connecting'
						? t('room.connecting')
						: t('room.offline')
	);

	function seatFor(request: RoomRequest): SeatId | '' {
		return chosen[request.requestId] ?? request.seatId ?? '';
	}

	function holder(seatId: SeatId | ''): RoomMember | undefined {
		return seatId ? host.members.find((m) => m.seatId === seatId) : undefined;
	}

	// The panel exists to show the code, so it opens a room straight away (if hovering or
	// pressing the button that opened it hasn't already). After Close room it stays closed.
	host.prepare();

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			toast(t('room.linkCopied'));
		} catch {
			toast(t('room.copyFailed'), t('room.copyFailedHint'));
		}
	}

	function approve(request: RoomRequest) {
		const seatId = seatFor(request);
		host.approve(request, seatId || undefined);
	}
</script>

<!--
	Players' phones: the room code and QR, requests from phones to approve, and who is in
	the room. Approving a seat names it on the board (a normal, undoable change).
-->
<!-- Laid out the same before the room opens, so the code and QR arrive without a reflow. -->
<div class="layout">
	<section class="join" aria-labelledby="room-code-label">
		<h2 id="room-code-label">{t('room.joinCode')}</h2>
		<p class="code" data-testid="room-code">
			{host.code ? formatRoomCode(host.code) : '··· ···'}
		</p>
		<div class="qr">
			{#if host.code}
				<QrCode value={link} label={t('room.qrLabel')} />
			{:else}
				<div class="qr-space" aria-busy={host.opening}></div>
			{/if}
		</div>
		<p class="link">{link}</p>
		<div class="row">
			{#if host.code}
				<IconButton icon="copy" label={t('room.copyLink')} onclick={copy} />
				<Button variant="quiet" icon="close" onclick={() => (closeOpen = true)}>
					{t('room.close')}
				</Button>
			{:else}
				<Button variant="accent" icon="players" onclick={() => host.open()} disabled={host.opening}>
					{t('room.open')}
				</Button>
			{/if}
		</div>
		<p class="status" role="status" data-status={host.status}>{statusText}</p>
	</section>

	<section aria-labelledby="requests-label">
		<h2 id="requests-label">{t('room.requests')}</h2>
		{#if host.requests.length === 0}
			<p class="none">{t('common.none')}</p>
		{:else}
			<ul class="list">
				{#each host.requests as request (request.requestId)}
					{@const seatId = seatFor(request)}
					{@const taken = holder(seatId)}
					<li
						class="request"
						aria-label={t('room.asksFor', {
							name: request.name,
							seat: seatLabel(request.seatId)
						})}
					>
						<p class="who">
							<strong>{request.name}</strong>
							<span>
								{request.seatId
									? t('room.asksForSeat', { seat: seatLabel(request.seatId) })
									: t('room.asksForAnySeat')}
							</span>
						</p>
						<Select
							label={t('room.seatFor', { name: request.name })}
							hideLabel
							value={seatId}
							options={seatOptions}
							onChange={(v) => (chosen[request.requestId] = v)}
						/>
						<p class="note">
							{taken
								? taken.name
									? t('room.movesOut', { name: taken.name })
									: t('room.movesOutAnother')
								: ''}
						</p>
						<div class="row">
							<Button
								variant="accent"
								icon="check"
								disabled={!connected}
								onclick={() => approve(request)}
							>
								{t('room.approve')}
							</Button>
							<Button variant="quiet" disabled={!connected} onclick={() => host.decline(request)}>
								{t('room.decline')}
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		<h2 id="players-label">{t('room.playersInRoom')}</h2>
		{#if seated.length === 0}
			<p class="none">{t('common.none')}</p>
		{:else}
			<ul class="list" aria-labelledby="players-label">
				{#each seated as member (member.memberId)}
					<li class="member">
						<span><strong>{member.name}</strong> · {seatNumberLabel(member.seatId)}</span>
						<Button
							variant="quiet"
							disabled={!connected || !member.seatId}
							onclick={() => host.unseat(member)}
						>
							{t('room.unseat')}
						</Button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<ConfirmDialog
	bind:open={closeOpen}
	title={t('room.closeTitle')}
	danger
	onConfirm={() => host.close()}
>
	<p class="dialog-text">
		{t('room.closeText')}
	</p>
</ConfirmDialog>

<style>
	.dialog-text {
		margin: 0;
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-size: 1.1rem;
	}
	h2 + :global(*) {
		margin-top: 0;
	}
	section {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-width: 0;
	}
	.note {
		min-height: 1.4em;
		margin: 0;
		color: var(--on-surface-muted);
	}
	/* Phones stack; a computer or tablet shows the code beside the lists. */
	.layout {
		display: grid;
		gap: var(--space-5);
	}
	@media (min-width: 48rem) {
		.layout {
			grid-template-columns: minmax(16rem, 22rem) 1fr;
		}
	}
	.code {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 2.6rem;
		letter-spacing: 0.08em;
		font-variant-numeric: tabular-nums;
	}
	.qr {
		width: min(100%, 16rem);
	}
	/* The QR's own size and face, held while the room opens. */
	.qr-space {
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--radius-md);
		background: var(--token-face);
	}
	.link,
	.status {
		min-height: 1.4em;
	}
	.link {
		margin: 0;
		overflow-wrap: anywhere;
		color: var(--on-surface-muted);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.status {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.none {
		margin: 0 0 var(--space-4);
		color: var(--on-surface-muted);
	}
	.list {
		display: grid;
		gap: var(--space-2);
		margin: 0 0 var(--space-4);
		padding: 0;
		list-style: none;
	}
	.request,
	.member {
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	.request {
		display: grid;
		gap: var(--space-2);
	}
	.who {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
	}
	.member {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
</style>
