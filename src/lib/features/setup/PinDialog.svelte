<script lang="ts">
	import { FORGOT_WAIT_MS, secondsLeft } from '#lib/core/rules/draw-lock.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CodeField from '#lib/ui/primitives/CodeField.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Menu from '#lib/ui/primitives/Menu.svelte';
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
		/**
		 * `cover`: the grim cover's PIN (Trevor, 2026-10-26), the same PIN, set and checked
		 * without locking the draw; Forgot PIN takes the cover off after its countdown.
		 */
		purpose?: 'draw' | 'cover';
		/** Locked, or unlocked (the right PIN or a finished Forgot PIN). */
		onDone?: () => void;
	}

	let { open = $bindable(), gameId, mode = 'unlock', purpose = 'draw', onDone }: Props = $props();
	const cover = $derived(purpose === 'cover');

	const PIN_LENGTH = 4;
	let pin = $state('');
	let again = $state('');
	let wrong = $state(false);
	let busy = $state(false);
	/** When Forgot PIN unlocks; undefined when it isn't counting down. */
	let forgotAt = $state<number | undefined>();
	let now = $state(Date.now());
	let menuOpen = $state(false);

	$effect(() => {
		if (!open) return;
		pin = '';
		again = '';
		wrong = false;
		forgotAt = undefined;
		menuOpen = false;
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

	function focusAgain() {
		document.getElementById('draw-pin-again')?.focus();
	}

	function finish() {
		// Blank before the sheet closes: nothing on screen keeps the PIN, not the closing sheet
		// nor the snapshot Android's back swipe takes of it (Trevor, 2026-10-25).
		pin = '';
		again = '';
		open = false;
		onDone?.();
	}

	async function submit(event?: Event) {
		event?.preventDefault();
		if (!ready || busy) return;
		busy = true;
		try {
			if (mode === 'set') {
				// Blank as the lock is set, before anything on screen can be kept (the history
				// entry the locked draw puts on, Android's back swipe snapshot of it).
				const chosen = pin;
				pin = '';
				again = '';
				if (cover) await drawLock.setPin(gameId, chosen);
				else await drawLock.lock(gameId, chosen);
				finish();
				return;
			}
			const result = cover
				? await drawLock.checkPin(gameId, pin)
				: await drawLock.unlock(gameId, pin);
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
			? t(cover ? 'setup.lock.uncovering' : 'setup.lock.forgotCountdown', {
					count: forgotSeconds
				})
			: waitSeconds > 0
				? t('setup.lock.wait', { count: waitSeconds })
				: mismatch
					? t('setup.lock.mismatch')
					: wrong
						? t('setup.lock.wrong')
						: ''
	);
</script>

<Dialog
	bind:open
	title={mode === 'set'
		? t(cover ? 'setup.lock.coverSetTitle' : 'setup.lock.setTitle')
		: t('setup.lock.enterTitle')}
	description={mode === 'set'
		? t(cover ? 'setup.lock.coverSetBody' : 'setup.lock.setBody')
		: undefined}
>
	<!-- Forgot PIN behind ⋯, so Cancel and Confirm keep one line on a phone (Trevor, 2026-10-25),
	     a menu item in the shared ⋯ menu, not a button (Trevor, 2026-11-02). -->
	{#snippet headActions()}
		{#if mode === 'unlock'}
			<Menu
				label={t('setup.lock.more')}
				bind:open={menuOpen}
				items={[
					forgotAt === undefined
						? {
								value: 'forgot',
								label: t('setup.lock.forgot'),
								onSelect: () => (forgotAt = Date.now() + FORGOT_WAIT_MS)
							}
						: {
								value: 'keep',
								label: t(cover ? 'setup.lock.keepCovered' : 'setup.lock.keepLocked'),
								onSelect: () => (forgotAt = undefined)
							}
				]}
			/>
		{/if}
	{/snippet}
	<form class="pin" onsubmit={(e) => void submit(e)} data-testid="pin-dialog">
		<label for="draw-pin">{t('setup.lock.pin')}</label>
		<!-- Like a phone's lock screen, the last digit checks the PIN with no Enter (Trevor,
		     2026-11-02); setting one, it moves on to PIN again, whose last digit locks. Enter
		     and Confirm still work, as the keyboard can cover Confirm (Trevor, 2026-10-25). -->
		<CodeField
			id="draw-pin"
			bind:value={pin}
			length={PIN_LENGTH}
			centred
			clearLabel={t('setup.lock.clear')}
			enterkeyhint={mode === 'set' ? 'next' : 'done'}
			onenter={() => (mode === 'set' ? focusAgain() : void submit())}
			oncomplete={() => (mode === 'set' ? focusAgain() : void submit())}
		/>
		{#if mode === 'set'}
			<label for="draw-pin-again">{t('setup.lock.again')}</label>
			<CodeField
				id="draw-pin-again"
				bind:value={again}
				length={PIN_LENGTH}
				centred
				clearLabel={t('setup.lock.clear')}
				enterkeyhint="done"
				onenter={() => void submit()}
				oncomplete={() => void submit()}
			/>
		{/if}
		<p class="message" role="status" data-testid="pin-message">{message}</p>
	</form>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={() => void submit()}
			disabled={!ready || busy}
		/>
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
