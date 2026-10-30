<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { formatRoomCode, ROOM_CODE_LENGTH } from '#lib/core/sync/room-code.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CodeField from '#lib/ui/primitives/CodeField.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Stepper from '#lib/ui/primitives/Stepper.svelte';
	import { PHONE_FRAME_PREFIX } from '#lib/ui/stored.ts';
	import { TestRoom, ZOOMS, type Zoom } from './bench.svelte.ts';
	import { DEVICES, deviceById } from './devices.ts';

	// The Test room (Trevor, 2026-10-30: "an interface, with ability to mockup sizing for
	// different phones"): the real join screen in phone-sized frames, each its own player
	// (stored.ts keeps a frame's data under its window name), with bots filling the room.

	const bench = new TestRoom();
	onDestroy(() => bench.leave());

	let typed = $state('');
	let logOpen = $state(false);

	const joinPath = $derived(
		bench.code ? resolve('/join/[code]', { code: bench.code }) : resolve('/join')
	);
	const zoomOptions = ZOOMS.map((z) => ({
		value: z,
		label: t('room.testRoom.zoomPercent', { percent: Math.round(Number(z) * 100) })
	}));
	const deviceOptions = DEVICES.map((d) => ({
		value: d.id,
		label: t('room.testRoom.deviceSize', { name: d.name, width: d.width, height: d.height })
	}));
</script>

<Page title={t('room.testRoom.title')}>
	{#snippet actions()}
		<Select
			icon="add"
			label={t('room.testRoom.addPhone')}
			options={deviceOptions}
			onChange={(id) => bench.addFrame(id)}
		/>
		<IconButton icon="history" label={t('room.testRoom.log')} onclick={() => (logOpen = true)} />
	{/snippet}
	{#snippet toolbar()}
		<div class="controls">
			<!-- The room: a code to join, or one this page opens and storytells. Both stay in place
			     once a room is chosen, disabled, so nothing moves. -->
			<form
				class="room"
				onsubmit={(e) => {
					e.preventDefault();
					void bench.join(typed);
				}}
			>
				<CodeField
					bind:value={typed}
					length={ROOM_CODE_LENGTH}
					group={3}
					clearLabel={t('room.testRoom.clearCode')}
				/>
				<Button type="submit" disabled={typed.length !== ROOM_CODE_LENGTH}
					>{t('room.testRoom.join')}</Button
				>
				<Button onclick={() => void bench.open()}>{t('room.testRoom.newRoom')}</Button>
			</form>
			<Stepper
				label={t('room.testRoom.bots')}
				lessLabel={t('room.testRoom.fewerBots')}
				moreLabel={t('room.testRoom.moreBots')}
				value={bench.botCount}
				max={bench.maxBots}
				onchange={(n) => bench.setBots(n)}
				testid="test-room-bots"
			>
				{#snippet display()}{t('room.testRoom.botsCount', { count: bench.botCount })}{/snippet}
			</Stepper>
			<Select
				label={t('room.testRoom.zoom')}
				hideLabel
				value={bench.zoom}
				options={zoomOptions}
				onChange={(z: Zoom) => bench.setZoom(z)}
			/>
			<Button
				variant="accent"
				disabled={!bench.storytelling || bench.playing}
				onclick={() => void bench.play()}>{t('room.testRoom.play')}</Button
			>
			<Button disabled={!bench.code} onclick={() => bench.leave()}
				>{t('room.testRoom.leave')}</Button
			>
		</div>
		<p class="status" role="status" data-testid="test-room-status">
			{bench.code
				? t('room.testRoom.inRoom', {
						code: formatRoomCode(bench.code),
						connected: bench.connected,
						bots: bench.botCount
					})
				: t('room.testRoom.noRoom')}
		</p>
	{/snippet}

	<div class="frames" style:--zoom={bench.zoom}>
		{#each bench.frames as frame (frame.n)}
			{@const device = deviceById(frame.device)!}
			<figure style:--w={device.width} style:--h={device.height} data-testid="phone-frame">
				<figcaption>
					<span
						>{t('room.testRoom.deviceSize', {
							name: device.name,
							width: device.width,
							height: device.height
						})}</span
					>
					<DeleteButton
						label={t('room.testRoom.removePhone', { name: device.name })}
						onclick={() => bench.removeFrame(frame.n)}
					/>
				</figcaption>
				<div class="screen">
					<iframe title={device.name} name="{PHONE_FRAME_PREFIX}{frame.n}" src={joinPath}></iframe>
				</div>
			</figure>
		{/each}
	</div>

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
	.room {
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
	.frames {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--space-3);
	}
	figure {
		margin: 0;
		display: grid;
		gap: var(--space-1);
	}
	figcaption {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1);
		font-size: 0.85rem;
	}
	/* The phone's own CSS pixels, scaled by the zoom: the frame lays out exactly as that phone. */
	.screen {
		width: calc(var(--w) * var(--zoom) * 1px); /* px-ok: a phone's CSS viewport */
		height: calc(var(--h) * var(--zoom) * 1px); /* px-ok: a phone's CSS viewport */
		overflow: hidden;
		border: 0.15rem solid var(--border);
		border-radius: 1rem;
		background: var(--surface);
	}
	iframe {
		width: calc(var(--w) * 1px); /* px-ok: a phone's CSS viewport */
		height: calc(var(--h) * 1px); /* px-ok: a phone's CSS viewport */
		border: 0;
		transform: scale(var(--zoom));
		transform-origin: 0 0;
	}
	.log {
		margin: 0;
		padding-inline-start: var(--space-3);
		font-size: 0.8rem;
		overflow-wrap: anywhere;
	}
</style>
