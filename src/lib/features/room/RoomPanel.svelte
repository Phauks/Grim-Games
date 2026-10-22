<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { resolve } from '$app/paths';
	import { seatsInOrder, type SeatId } from '#lib/core/model/index.ts';
	import { fromScript, scriptLogo } from '#lib/core/data/index.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import type { RoomMember, RoomRequest } from '#lib/core/sync/room.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import ScriptQrCenter from '#lib/features/scripts/ScriptQrCenter.svelte';
	import { gameLine } from '#lib/features/player/byline.ts';
	import { scriptVersion } from '#lib/features/player/player-script.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { roomHost } from './host.svelte.ts';

	interface Props {
		game: OpenGame;
	}

	let { game }: Props = $props();

	const host = roomHost();
	$effect(() => host.attach(game));

	/** New code or New link asks first; which one stays set while the dialog closes. */
	let refreshOpen = $state(false);
	let refreshKind = $state<'room' | 'watch'>('room');
	function askRefresh(kind: 'room' | 'watch') {
		refreshKind = kind;
		refreshOpen = true;
	}
	const shareTabs = $derived([
		{ value: 'players' as const, label: t('room.tab.players') },
		{ value: 'watch' as const, label: t('room.tab.watch') }
	]);
	let tab = $state<'players' | 'watch'>('players');
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
	// The key goes in the hash, which never reaches the server (CLAUDE.md).
	const watchLink = $derived(
		host.code && host.viewerKey
			? `${location.origin}${resolve('/watch/[code]', { code: host.code })}#${host.viewerKey}`
			: ''
	);
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

	// The game's script in the middle of the QR: its logo, or its name (Trevor, 2026-10-19).
	// A script with neither leaves the middle as plain code.
	const loadedScript = $derived(
		officialData.current ? fromScript(game.game.script, officialData.current).script : undefined
	);
	const scriptName = $derived(loadedScript?.name ?? game.game.script.meta?.name ?? '');
	const logo = $derived(loadedScript && scriptLogo(loadedScript));
	let logoFailed = $state(false);

	function seatFor(request: RoomRequest): SeatId | '' {
		return chosen[request.requestId] ?? request.seatId ?? '';
	}

	function holder(seatId: SeatId | ''): RoomMember | undefined {
		return seatId ? host.members.find((m) => m.seatId === seatId) : undefined;
	}

	// The panel exists to show the code, so it opens a room straight away (if hovering or
	// pressing the button that opened it hasn't already).
	host.prepare();

	// Shared and copied text carries the code as well as the link, so it can be typed at /join
	// if the link won't open. The link holds the code too, for apps that keep only the link.
	// It names the game as its byline does (Trevor, 2026-10-19): script, version, author and
	// Storyteller, each left out when unknown.
	const gameText = $derived(
		gameLine(scriptName, {
			version: scriptVersion(undefined, game.game.script.meta),
			author: game.game.script.meta?.author,
			storyteller: game.game.storytellerName
		})
	);
	const message = $derived(
		!host.code
			? ''
			: gameText
				? t('room.shareGameText', { game: gameText, code: formatRoomCode(host.code) })
				: t('room.shareText', { code: formatRoomCode(host.code) })
	);

	function approve(request: RoomRequest) {
		const seatId = seatFor(request);
		host.approve(request, seatId || undefined);
	}
</script>

<!--
	Share: the room code and QR, requests from phones to approve, and who is in
	the room. Approving a seat names it on the board (a normal, undoable change).
-->
{#snippet scriptCenter()}
	<ScriptQrCenter {logo} name={scriptName} bind:failed={logoFailed} />
{/snippet}

<!-- The players' join code and the view-only grimoire each in their own tab (Trevor, 2026-10-19). -->
<Tabs label={t('room.tabs')} tabs={shareTabs} bind:value={tab}>
	{#snippet panel(which)}
		{#if which === 'players'}{@render players()}{:else}{@render watching()}{/if}
	{/snippet}
</Tabs>

{#snippet watching()}
	<div class="layout">
		<!-- Specters: spectators watch the whole grimoire (Trevor, 2026-10-18). Off until
		     turned on; the link's QR and buttons stay in place while it is off. -->
		<section class="watch" data-testid="watch-link">
			<SettingToggle
				label={t('room.watch.toggle')}
				description={t('room.watch.hint')}
				checked={!!host.viewerKey}
				disabled={!host.code}
				onChange={(on) => void host.setViewers(on)}
			/>
			<!-- Streaming: the QR and link can stay off screen (Trevor, 2026-10-21). -->
			<SettingToggle
				label={t('settings.hideWatchLink')}
				description={t('settings.hideWatchLinkHelp')}
				checked={preferences.current.hideWatchLink}
				onChange={(hideWatchLink) => preferences.update({ hideWatchLink })}
			/>
			<SharePanel
				url={watchLink || undefined}
				title={t('room.watch.title')}
				qrLabel={t('room.watch.qrLabel')}
				pending={t('room.watch.off')}
				text={!watchLink
					? undefined
					: gameText
						? t('room.watch.shareGameText', { game: gameText })
						: t('room.watch.shareText')}
				qrCenter={logo || scriptName ? scriptCenter : undefined}
				qrCenterShape={logo && !logoFailed ? 'square' : 'wide'}
				qrCaption={t('room.watch.qrCaption')}
				hidden={preferences.current.hideWatchLink}
				refresh={{
					label: t('room.watch.refresh'),
					disabled: !watchLink,
					// A new link in one step, not off and on (Trevor, 2026-10-20).
					onclick: () => askRefresh('watch')
				}}
			/>
			<!-- Who is watching now (Trevor, 2026-10-20), always in its place. -->
			<p class="status" data-testid="watchers">
				{t('room.watch.watchers', { count: watchLink ? host.watchers : 0 })}
			</p>
			<p class="status" role="status">{host.grimoireTooLarge ? t('room.watch.tooLarge') : ''}</p>
		</section>
	</div>
{/snippet}

{#snippet players()}
	<!-- Laid out the same before the room opens, so the code and QR arrive without a reflow. -->
	<div class="layout">
		<section class="join">
			<SharePanel
				url={link || undefined}
				title={t('room.title')}
				qrLabel={t('room.qrLabel')}
				pending={host.problem ? t('room.openFailed') : t('room.openingRoom')}
				code={{ label: t('room.joinCode'), value: host.code && formatRoomCode(host.code) }}
				text={message || undefined}
				qrCenter={logo || scriptName ? scriptCenter : undefined}
				qrCenterShape={logo && !logoFailed ? 'square' : 'wide'}
				refresh={{
					label: t('room.refresh'),
					disabled: host.opening,
					// No Open or Close room (Trevor, 2026-10-20): a room is just there while the
					// game is, and a new code replaces it, deleting the old room.
					onclick: () => (host.code ? askRefresh('room') : void host.open())
				}}
			/>
		</section>

		<section aria-labelledby="requests-label">
			<!-- How the room is doing and who is in it, under its own header (Trevor, 2026-10-20). -->
			<h2 id="status-label">{t('room.status')}</h2>
			<!-- One line per thing it reports (Trevor, 2026-10-20), each always in its place. -->
			<div class="status-lines">
				<p class="status connection" role="status" data-status={host.status}>
					{#if host.code}<span
							class="dot"
							class:live={connected}
							data-testid="connection-dot"
							aria-hidden="true"
						></span>{/if}<span>{statusText}</span>
				</p>
				<p class="status" data-testid="status-players">
					{connected ? t('common.players', { count: seated.length }) : ''}
				</p>
				<p class="status" data-testid="status-watching">
					{connected ? t('room.watching', { count: host.watchers }) : ''}
				</p>
			</div>
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
{/snippet}

<ConfirmDialog
	bind:open={refreshOpen}
	title={refreshKind === 'room' ? t('room.refreshTitle') : t('room.watch.refreshTitle')}
	danger
	onConfirm={() => void (refreshKind === 'room' ? host.refreshRoom() : host.refreshViewers())}
>
	<p class="dialog-text">
		{refreshKind === 'room' ? t('room.refreshText') : t('room.watch.refreshText')}
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
	.status-lines {
		margin-bottom: var(--space-4);
	}
	.connection {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	/* Hollow while connecting or offline, filled once connected. */
	.dot {
		flex: none;
		width: 0.75em;
		height: 0.75em;
		border: 0.15em solid var(--on-surface-muted);
		border-radius: 50%;
	}
	.dot.live {
		border-color: var(--good);
		background: var(--good);
	}
	.watch {
		display: grid;
		gap: var(--space-2);
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
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.status {
		min-height: 1.4em;
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
