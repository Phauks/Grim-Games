<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { BOT_ACTIONS, type BotAction } from '#lib/core/sync/room-bots/brain.ts';
	import { formatRoomCode, ROOM_CODE_LENGTH } from '#lib/core/sync/room-code.ts';
	import { MAX_MEMBERS } from '#lib/core/sync/room-presence.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CodeField from '#lib/ui/primitives/CodeField.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import FullScreenStage from '#lib/ui/layout/FullScreenStage.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { botName, frameName, TestRoom, ZOOMS, type Zoom } from './bench.svelte.ts';
	import { DEVICES, deviceById, STORYTELLER_SCREENS } from './devices.ts';

	// The Test room (Trevor, 2026-10-30: "a place where i fully control the fake game, and have
	// access to a certain number of fake players, along with perhaps some fast tools"): you are
	// the Storyteller in the real app on the left, and the fake players follow its room, each on
	// a device of its own ("so i can choose having multiple types of different devices").

	const bench = new TestRoom();
	onMount(() => bench.start());
	onDestroy(() => bench.stop());

	let typed = $state('');
	let logOpen = $state(false);
	let closeOpen = $state(false);
	/** The screens' area's width, so no screen is wider than it (no sideways scrolling). */
	let framesWidth = $state(0);
	let storytellerFrame = $state<HTMLIFrameElement>();

	async function closeRoom() {
		const own = bench.ownRoom;
		typed = '';
		await bench.close();
		// Its room gone, the Storyteller screen starts again from Home.
		if (own) storytellerFrame?.contentWindow?.location.assign(resolve('/'));
	}

	const sized = (d: { name: string; width: number; height: number }) =>
		t('room.testRoom.deviceSize', { name: d.name, width: d.width, height: d.height });
	const deviceOptions = DEVICES.map((d) => ({ value: d.id, label: sized(d) }));
	const screenOptions = STORYTELLER_SCREENS.map((d) => ({ value: d.id, label: sized(d) }));
	const zoomOptions = ZOOMS.map((z) => ({
		value: z,
		label: t('room.testRoom.zoomPercent', { percent: Math.round(Number(z) * 100) })
	}));
	const toolLabels: Record<BotAction, string> = {
		seat: t('room.testRoom.tool.seat'),
		count: t('room.testRoom.tool.count'),
		role: t('room.testRoom.tool.role'),
		vote: t('room.testRoom.tool.vote'),
		rate: t('room.testRoom.tool.rate'),
		message: t('room.testRoom.tool.message')
	};

	const screen = $derived(STORYTELLER_SCREENS.find((s) => s.id === bench.screen)!);
	const joinPath = $derived(
		bench.code ? resolve('/join/[code]', { code: bench.code }) : resolve('/join')
	);
	const allShown = $derived(bench.players.length > 0 && bench.players.every((p) => p.shown));

	/** Player `i`'s seat number in the room, if it has one. */
	function seatOf(i: number): string {
		const view = bench.bot(i)?.view;
		const seat = view?.public?.seats.find((s) => s.seatId === view.me.seatId);
		return seat ? t('room.testRoom.seat', { number: seat.seatNumber }) : t('common.none');
	}
</script>

<Page title={t('room.testRoom.title')}>
	{#snippet actions()}
		<IconButton icon="history" label={t('room.testRoom.log')} onclick={() => (logOpen = true)} />
	{/snippet}
	{#snippet toolbar()}
		<div class="controls">
			<!-- The players' room: the Storyteller screen's, or a code storytold on another device. -->
			<form
				class="room"
				onsubmit={(e) => {
					e.preventDefault();
					bench.joinCode(typed);
				}}
			>
				<label class="visually-hidden" for="test-room-code">{t('room.testRoom.code')}</label>
				<CodeField
					id="test-room-code"
					bind:value={typed}
					length={ROOM_CODE_LENGTH}
					group={3}
					clearLabel={t('room.testRoom.clearCode')}
				/>
				<Button type="submit" disabled={typed.length !== ROOM_CODE_LENGTH}
					>{t('room.testRoom.join')}</Button
				>
				<Button
					disabled={!bench.typedCode}
					onclick={() => {
						typed = '';
						bench.joinCode(undefined);
					}}>{t('room.testRoom.follow')}</Button
				>
			</form>
			<Button variant="danger" disabled={!bench.code} onclick={() => (closeOpen = true)}
				>{t('room.testRoom.close')}</Button
			>
			<Select
				label={t('room.testRoom.screen')}
				hideLabel
				value={bench.screen}
				options={screenOptions}
				onChange={(s) => bench.setScreen(s)}
			/>
			<Select
				label={t('room.testRoom.zoom')}
				hideLabel
				value={bench.zoom}
				options={zoomOptions}
				onChange={(z: Zoom) => bench.setZoom(z)}
			/>
		</div>
		<p class="status" role="status" data-testid="test-room-status">
			{bench.code
				? t('room.testRoom.inRoom', {
						code: formatRoomCode(bench.code),
						connected: bench.connected,
						players: bench.players.length
					})
				: t('room.testRoom.noRoom')}
		</p>
	{/snippet}

	{#snippet side()}
		<section class="panel" aria-label={t('room.testRoom.players')}>
			<NumberSelect
				label={t('room.testRoom.players')}
				hideLabel
				value={bench.players.length}
				max={MAX_MEMBERS}
				format={(count) => t('room.testRoom.playersCount', { count })}
				onchange={(n) => bench.setCount(n)}
				testid="test-room-players"
			/>
			<Toggle
				label={t('room.testRoom.auto')}
				checked={bench.auto}
				onChange={(on) => bench.setAuto(on)}
			/>
			<Toggle
				label={t('room.testRoom.showAll')}
				checked={allShown}
				disabled={!bench.players.length}
				onChange={(on) => bench.showAll(on)}
			/>
			<div class="row-tools">
				<Button disabled={!bench.players.length} onclick={() => bench.mixDevices()}
					>{t('room.testRoom.mixDevices')}</Button
				>
				<Select
					label={t('room.testRoom.allOn')}
					hideLabel
					placeholder={t('room.testRoom.allOn')}
					options={deviceOptions}
					disabled={!bench.players.length}
					onChange={(d) => bench.allOn(d)}
				/>
			</div>
		</section>

		<!-- Fast tools: every connected player makes the same tap now. -->
		<section class="panel" aria-label={t('room.testRoom.everyone')}>
			<h2>{t('room.testRoom.everyone')}</h2>
			<div class="tools">
				{#each BOT_ACTIONS as kind (kind)}
					<Button disabled={!bench.connected} onclick={() => bench.everyone(kind)}
						>{toolLabels[kind]}</Button
					>
				{/each}
				<Button disabled={!bench.connected} onclick={() => bench.lockAll(true)}
					>{t('room.testRoom.lockAll')}</Button
				>
				<Button disabled={!bench.code} onclick={() => bench.lockAll(false)}
					>{t('room.testRoom.unlockAll')}</Button
				>
			</div>
		</section>

		<ul class="players" data-testid="test-room-player-list">
			{#each bench.players as player, i (player.key)}
				{@const bot = bench.bot(i)}
				{@const name = botName(i)}
				<li data-testid="test-room-player">
					<span class="dot" data-on={bot?.connected ? '' : undefined} aria-hidden="true"></span>
					<span class="name">{name}</span>
					<span class="seat">{seatOf(i)}</span>
					<Select
						label={t('room.testRoom.deviceOf', { name })}
						hideLabel
						value={player.device}
						options={deviceOptions}
						onChange={(d) => bench.setDevice(i, d)}
					/>
					<IconButton
						icon={player.shown ? 'hide' : 'show'}
						label={t(player.shown ? 'room.testRoom.hidePhone' : 'room.testRoom.showPhone', {
							name
						})}
						aria-pressed={player.shown}
						onclick={() => bench.showPhone(i, !player.shown)}
					/>
					<IconButton
						icon="lock"
						label={t('room.testRoom.lock', { name })}
						aria-pressed={!!bot?.locked}
						disabled={!bot}
						onclick={() => bench.lock(i, !bot?.locked)}
					/>
				</li>
			{/each}
		</ul>
	{/snippet}

	<!-- Full screen (Trevor, 2026-10-31): the screens alone, without the controls round them. -->
	<FullScreenStage testid="test-room-stage">
		<div
			class="frames"
			style:--zoom={bench.zoom}
			style:--room={framesWidth || undefined}
			bind:clientWidth={framesWidth}
		>
			<figure style:--w={screen.width} style:--h={screen.height} data-testid="storyteller-frame">
				<figcaption>{t('room.testRoom.storyteller')}</figcaption>
				<div class="screen">
					<iframe
						title={t('room.testRoom.storyteller')}
						name="grimbinder-storyteller"
						bind:this={storytellerFrame}
						src={resolve('/')}
					></iframe>
				</div>
			</figure>
			{#each bench.players as player, i (player.key)}
				{#if player.shown}
					{@const device = deviceById(player.device)!}
					<figure style:--w={device.width} style:--h={device.height} data-testid="phone-frame">
						<figcaption>{botName(i)} · {sized(device)}</figcaption>
						<div class="screen">
							<!-- Keyed by device, so a new size reloads it as that phone. -->
							{#key player.device}
								<iframe title={botName(i)} name={frameName(i)} src={joinPath}></iframe>
							{/key}
						</div>
					</figure>
				{/if}
			{/each}
		</div>
	</FullScreenStage>

	<ConfirmDialog
		bind:open={closeOpen}
		title={t('room.testRoom.closeConfirm')}
		description={t(bench.ownRoom ? 'room.testRoom.closeOwn' : 'room.testRoom.closeTyped')}
		danger
		onConfirm={() => void closeRoom()}
	/>

	<BottomSheet bind:open={logOpen} title={t('room.testRoom.log')}>
		{#if bench.log.length}
			<ol class="log" data-testid="test-room-log">
				{#each bench.log as line, i (i)}<li>{line}</li>{/each}
			</ol>
		{:else}
			<p>{t('common.none')}</p>
		{/if}
	</BottomSheet>
</Page>

<style>
	.controls,
	.room,
	.row-tools,
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.status {
		margin: var(--space-1) 0 0;
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.panel {
		display: grid;
		gap: var(--space-2);
		padding-block-end: var(--space-3);
		border-bottom: 0.0625rem solid var(--border);
		margin-block-end: var(--space-3);
	}
	h2 {
		margin: 0;
		font-size: 1rem;
	}
	.players {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.players li {
		display: grid;
		grid-template-columns: auto 1fr auto minmax(0, 2fr) auto auto;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-1);
		border-bottom: 0.0625rem solid var(--border);
	}
	/* As the room's own status (RoomPanel): hollow while offline, filled once connected. */
	.dot {
		width: 0.75em;
		height: 0.75em;
		border: 0.15em solid var(--on-surface-muted);
		border-radius: 50%;
	}
	.dot[data-on] {
		border-color: var(--good);
		background: var(--good);
	}
	.seat {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.frames {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--space-3);
		/* Room for Full screen in the top right corner, so it covers no screen's caption. */
		padding-inline-end: calc(var(--tap-target) + var(--space-2));
		box-sizing: border-box;
	}
	/* Filling the screen, the screens scroll inside it. */
	:global([data-filled]) > .frames {
		overflow: auto;
		padding: var(--space-3);
		padding-inline-end: calc(var(--tap-target) + var(--space-4));
	}
	/* The zoom picked, or less where the screen would be wider than the area (Trevor's Pixel,
	   2026-10-31: a tablet screen at 50% ran off the side of the phone): the area's width less
	   its padding and a frame's border, in CSS pixels. */
	figure {
		--fit: min(var(--zoom), (var(--room, 100000) - 80) / var(--w));
		margin: 0;
		display: grid;
		gap: var(--space-1);
	}
	figcaption {
		font-size: 0.85rem;
	}
	/* The device's own CSS pixels, scaled by the zoom: the frame lays out exactly as that device. */
	.screen {
		width: calc(var(--w) * var(--fit) * 1px); /* px-ok: a device's CSS viewport */
		height: calc(var(--h) * var(--fit) * 1px); /* px-ok: a device's CSS viewport */
		overflow: hidden;
		border: 0.15rem solid var(--border);
		border-radius: 1rem;
		background: var(--surface);
	}
	iframe {
		width: calc(var(--w) * 1px); /* px-ok: a device's CSS viewport */
		height: calc(var(--h) * 1px); /* px-ok: a device's CSS viewport */
		border: 0;
		transform: scale(var(--fit));
		transform-origin: 0 0;
	}
	.log {
		margin: 0;
		padding-inline-start: var(--space-3);
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}
</style>
