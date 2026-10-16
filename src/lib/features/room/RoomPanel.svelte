<script lang="ts">
	import { resolve } from '$app/paths';
	import { seatsInOrder, type SeatId } from '#lib/core/model/index.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import type { RoomMember, RoomRequest } from '#lib/core/sync/room.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
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
	let opening = $state(false);
	/** The seat chosen for each request, when the Storyteller picks a different one. */
	let chosen = $state<Record<string, SeatId | ''>>({});

	const seats = $derived(seatsInOrder(game.game));
	const seatLabel = (seatId?: SeatId) => {
		const i = seats.findIndex((s) => s.seatId === seatId);
		if (i < 0) return 'No seat';
		const name = seats[i].playerName;
		return name ? `Seat ${i + 1} · ${name}` : `Seat ${i + 1}`;
	};
	const seatNumberLabel = (seatId?: SeatId) => {
		const i = seats.findIndex((s) => s.seatId === seatId);
		return i < 0 ? 'No seat' : `Seat ${i + 1}`;
	};
	const seatOptions = $derived([
		{ value: '' as SeatId | '', label: 'No seat' },
		...seats.map((s) => ({ value: s.seatId as SeatId | '', label: seatLabel(s.seatId) }))
	]);
	const link = $derived(
		host.code ? `${location.origin}${resolve('/join/[code]', { code: host.code })}` : ''
	);
	const connected = $derived(host.status === 'open');
	const seated = $derived(host.members.filter((m) => m.name !== undefined));
	const statusText = $derived(
		host.status === 'open'
			? 'Connected'
			: host.status === 'connecting'
				? 'Connecting…'
				: 'Offline: reconnecting. The game carries on here.'
	);

	function seatFor(request: RoomRequest): SeatId | '' {
		return chosen[request.requestId] ?? request.seatId ?? '';
	}

	function holder(seatId: SeatId | ''): RoomMember | undefined {
		return seatId ? host.members.find((m) => m.seatId === seatId) : undefined;
	}

	async function openRoom() {
		opening = true;
		await host.open();
		opening = false;
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			toast('Link copied');
		} catch {
			toast('Could not copy the link', 'Use the QR code instead.');
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
{#if !host.code}
	<section class="empty">
		<p>
			Players open the room on their own phones, ask for their seat and name, and see names and
			deaths as you change them. Nothing changes in the grimoire until you approve it, and phones
			never see characters or reminders.
		</p>
		<Button variant="accent" icon="players" onclick={openRoom} disabled={opening}>
			Open a room
		</Button>
		<p class="problem" role="status">{host.problem ?? ''}</p>
	</section>
{:else}
	<div class="layout">
		<section class="join" aria-labelledby="room-code-label">
			<h2 id="room-code-label">Join code</h2>
			<p class="code" data-testid="room-code">{formatRoomCode(host.code)}</p>
			<div class="qr"><QrCode value={link} label="QR code to join the room" /></div>
			<p class="link">{link}</p>
			<div class="row">
				<Button icon="share" onclick={copy}>Copy link</Button>
				<Button variant="quiet" icon="close" onclick={() => (closeOpen = true)}>Close room</Button>
			</div>
			<p class="status" role="status" data-status={host.status}>{statusText}</p>
		</section>

		<section aria-labelledby="requests-label">
			<h2 id="requests-label">Requests</h2>
			{#if host.requests.length === 0}
				<p class="none">None</p>
			{:else}
				<ul class="list">
					{#each host.requests as request (request.requestId)}
						{@const seatId = seatFor(request)}
						{@const taken = holder(seatId)}
						<li
							class="request"
							aria-label={`${request.name} asks for ${seatLabel(request.seatId)}`}
						>
							<p class="who">
								<strong>{request.name}</strong>
								<span>asks for {request.seatId ? seatLabel(request.seatId) : 'any seat'}</span>
							</p>
							<Select
								label={`Seat for ${request.name}`}
								hideLabel
								value={seatId}
								options={seatOptions}
								onChange={(v) => (chosen[request.requestId] = v)}
							/>
							<p class="note">
								{taken ? `Moves ${taken.name ?? 'another phone'} out of this seat.` : ''}
							</p>
							<div class="row">
								<Button
									variant="accent"
									icon="check"
									disabled={!connected}
									onclick={() => approve(request)}
								>
									Approve
								</Button>
								<Button variant="quiet" disabled={!connected} onclick={() => host.decline(request)}>
									Decline
								</Button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}

			<h2 id="players-label">Players in the room</h2>
			{#if seated.length === 0}
				<p class="none">None</p>
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
								Unseat
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
{/if}

<Dialog bind:open={closeOpen} role="alertdialog" title="Close the room?">
	<p class="dialog-text">
		Everyone's phone leaves the room and its code stops working. The grimoire is not changed.
	</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (closeOpen = false)}>Keep it open</Button>
		<Button
			variant="accent"
			onclick={() => {
				host.close();
				closeOpen = false;
			}}
		>
			Close room
		</Button>
	{/snippet}
</Dialog>

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
	.empty {
		max-width: calc(36 * var(--u));
	}
	.empty p {
		margin: 0;
	}
	.problem,
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
