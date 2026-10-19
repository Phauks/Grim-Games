<script lang="ts">
	import { FORGOT_WAIT_MS, secondsLeft } from '#lib/core/rules/draw-lock.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CodeField from '#lib/ui/primitives/CodeField.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { drawLock } from './draw-lock.svelte.ts';

	/**
	 * The Storyteller PIN of the locked pass-the-phone draw (Trevor, 2026-10-19): set it
	 * (typed twice), or type it to unlock. Wrong PINs make entry wait, and "Forgot PIN"
	 * unlocks after a countdown everyone can see (core/rules/draw-lock.ts). Used by the Draw
	 * page, its leave guard, and the board while the game's draw is locked.
	 */
	interface Props {
		open: boolean;
		gameId: string;
		/** `set` locks the draw; `unlock` asks for the PIN. */
		mode?: 'set' | 'unlock';
		/** Locked, or unlocked (the right PIN or a finished Forgot PIN). */
		onDone?: () => void;
	}

	let { open = $bindable(), gameId, mode = 'unlock', onDone }: Props = $props();

	const PIN_LENGTH = 4;
	let pin = $state('');
	let again = $state('');
	let wrong = $state(false);
	let busy = $state(false);
	/** When Forgot PIN unlocks; undefined when it isn't counting down. */
	let forgotAt = $state<number | undefined>();
	let now = $state(Date.now());

	$effect(() => {
		if (!open) return;
		pin = '';
		again = '';
		wrong = false;
		forgotAt = undefined;
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(timer);
	});

	const waitSeconds = $derived(secondsLeft(drawLock.waitUntil(gameId), now));
	const forgotSeconds = $derived(forgotAt === undefined ? 0 : secondsLeft(forgotAt, now));
	const mismatch = $derived(mode === 'set' && again.length === PIN_LENGTH && again !== pin);
	const ready = $derived(
		mode === 'set'
			? pin.length === PIN_LENGTH && again === pin
			: pin.length === PIN_LENGTH && waitSeconds === 0
	);

	// Forgot PIN: the countdown runs out in view, then the draw unlocks.
	$effect(() => {
		if (open && forgotAt !== undefined && now >= forgotAt) {
			forgotAt = undefined;
			drawLock.clear(gameId);
			finish();
		}
	});

	function finish() {
		open = false;
		onDone?.();
	}

	async function submit(event?: Event) {
		event?.preventDefault();
		if (!ready || busy) return;
		busy = true;
		try {
			if (mode === 'set') {
				await drawLock.lock(gameId, pin);
				finish();
				return;
			}
			const result = await drawLock.unlock(gameId, pin);
			if (result === 'ok') finish();
			else {
				wrong = result === 'wrong';
				pin = '';
				now = Date.now();
			}
		} finally {
			busy = false;
		}
	}

	/** One line of feedback, always the same height so nothing moves. */
	const message = $derived(
		forgotAt !== undefined
			? t('setup.lock.forgotCountdown', { seconds: forgotSeconds })
			: waitSeconds > 0
				? t('setup.lock.wait', { seconds: waitSeconds })
				: mismatch
					? t('setup.lock.mismatch')
					: wrong
						? t('setup.lock.wrong')
						: ''
	);
</script>

<Dialog
	bind:open
	title={mode === 'set' ? t('setup.lock.setTitle') : t('setup.lock.enterTitle')}
	description={mode === 'set' ? t('setup.lock.setBody') : undefined}
>
	<form class="pin" onsubmit={(e) => void submit(e)} data-testid="pin-dialog">
		<label for="draw-pin">{t('setup.lock.pin')}</label>
		<CodeField
			id="draw-pin"
			bind:value={pin}
			length={PIN_LENGTH}
			masked
			centred
			clearLabel={t('setup.lock.clear')}
		/>
		{#if mode === 'set'}
			<label for="draw-pin-again">{t('setup.lock.again')}</label>
			<CodeField
				id="draw-pin-again"
				bind:value={again}
				length={PIN_LENGTH}
				masked
				centred
				clearLabel={t('setup.lock.clear')}
			/>
		{/if}
		<p class="message" role="status" data-testid="pin-message">{message}</p>
	</form>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={() => void submit()}
			disabled={!ready || busy}
		>
			{#snippet start()}
				{#if mode === 'unlock'}
					{#if forgotAt === undefined}
						<Button variant="quiet" onclick={() => (forgotAt = Date.now() + FORGOT_WAIT_MS)}
							>{t('setup.lock.forgot')}</Button
						>
					{:else}
						<Button variant="quiet" onclick={() => (forgotAt = undefined)}
							>{t('setup.lock.keepLocked')}</Button
						>
					{/if}
				{/if}
			{/snippet}
		</ModalActions>
	{/snippet}
</Dialog>

<style>
	.pin {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
	}
	.message {
		min-height: 1.5em;
		margin: 0;
		color: var(--on-surface-muted);
		text-align: center;
	}
</style>
