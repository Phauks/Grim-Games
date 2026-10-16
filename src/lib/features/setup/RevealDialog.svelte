<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Alignment, Character } from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';

	interface Props {
		open: boolean;
		/** The tile's number on the draw screen. */
		number: number;
		/** What the player sees: never the grimoire character (the Drunk sees a Townsfolk). */
		shows: Character;
		/**
		 * The grimoire character is a Traveller: the Storyteller may set its alignment now or
		 * leave it as None and set it on the first night (Trevor, 2026-10-16).
		 */
		needsAlignment: boolean;
		/** "Seat 3", the seat the draw goes to. */
		seatLabel: string;
		playerName: string;
		onConfirm: (details: { playerName: string; alignment?: Alignment }) => void;
	}

	let {
		open = $bindable(),
		number,
		shows,
		needsAlignment,
		seatLabel,
		playerName,
		onConfirm
	}: Props = $props();

	let name = $state('');
	let alignment = $state<Alignment | ''>('');
	/** False while the player still has to type their name to see the token. */
	let revealed = $state(true);
	$effect(() => {
		if (open) {
			name = playerName;
			alignment = '';
			revealed = !preferences.current.requireName || playerName.trim() !== '';
		}
	});

	function confirm() {
		onConfirm({ playerName: name, ...(alignment !== '' ? { alignment } : {}) });
	}

	// On a computer, Enter (outside a field or button) does the main action: Reveal, then Confirm.
	function onWindowKey(event: KeyboardEvent) {
		if (!open || event.key !== 'Enter' || event.repeat || event.defaultPrevented) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, button, a, [role="radio"]')) return;
		event.preventDefault();
		if (revealed) confirm();
		else if (name.trim() !== '') revealed = true;
	}
</script>

<svelte:window onkeydown={onWindowKey} />

<!--
	The player's own reveal. A drawn tile is never put back (Trevor, 2026-10-15): closing the
	reveal keeps it in the player's hand (the draw is saved) until it is confirmed.
-->
<Dialog bind:open title={t('setup.draw.tile', { number })} size="full">
	<div class="reveal" data-testid="reveal">
		<p class="seat">{seatLabel}</p>
		<label class="player">
			<span>{t('setup.reveal.name')}</span>
			<input
				type="text"
				autocomplete="off"
				enterkeyhint="done"
				placeholder={t('common.none')}
				bind:value={name}
				onkeydown={(e) => {
					// Enter keeps the name and closes the phone keyboard; Confirm stays a separate tap.
					if (e.key === 'Enter') {
						e.preventDefault();
						e.currentTarget.blur();
					}
				}}
			/>
		</label>
		<!-- Hidden until a name is entered when that's required; the space stays reserved. -->
		<div class="token">
			{#if revealed}<CharacterToken character={shows} size={160} />{:else}<span
					class="hidden-token"
					data-testid="reveal-locked">{t('setup.reveal.locked')}</span
				>{/if}
		</div>
		<p class="name" data-testid="reveal-name" class:concealed={!revealed}>
			<!-- eslint-disable-next-line grim/names-as-badges -- caption under the revealed token -->
			{revealed ? shows.name : ''}
		</p>
		<p class="ability" class:concealed={!revealed}>{revealed ? shows.ability : ''}</p>
		<div class="alignment" aria-hidden={!needsAlignment}>
			{#if needsAlignment}
				<ChoiceGroup
					label={t('setup.reveal.alignment')}
					layout="row"
					value={alignment === '' ? 'none' : alignment}
					options={[
						{ value: 'none', label: t('common.none') },
						{ value: 'good', label: t('setup.reveal.good') },
						{ value: 'evil', label: t('setup.reveal.evil') }
					]}
					onChange={(v) => (alignment = v === 'none' ? '' : (v as Alignment))}
				/>
			{/if}
		</div>
	</div>
	{#snippet actions()}
		{#if revealed}
			<Button variant="accent" onclick={confirm}>{t('setup.reveal.confirm')}</Button>
		{:else}
			<Button variant="accent" disabled={name.trim() === ''} onclick={() => (revealed = true)}
				>{t('setup.reveal.reveal')}</Button
			>
		{/if}
	{/snippet}
</Dialog>

<style>
	.reveal {
		display: grid;
		flex: 1;
		align-content: start;
		justify-items: center;
		gap: var(--space-2);
		overflow-y: auto;
		text-align: center;
	}
	.seat {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.token {
		display: grid;
		place-items: center;
		width: calc(10 * var(--u));
		height: calc(10 * var(--u));
	}
	.hidden-token {
		display: grid;
		place-items: center;
		width: calc(10 * var(--u));
		height: calc(10 * var(--u));
		padding: var(--space-3);
		border-radius: 50%;
		background: var(--token-face);
		color: var(--on-token);
		box-shadow: inset 0 0 0 3px var(--token-rim);
		font-size: 0.9rem;
	}
	.concealed {
		min-height: 1.3em;
	}
	.name {
		margin: 0;
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
		font-size: 1.6rem;
		color: var(--heading);
	}
	.ability {
		max-width: 28rem;
		margin: 0;
		font-family: var(--font-ability);
	}
	.player {
		display: grid;
		gap: var(--space-1);
		width: min(100%, 20rem);
		text-align: start;
	}
	.player input {
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		font-family: var(--font-player);
	}
	/* Space for the Traveller's alignment is always reserved, so the actions never move. */
	.alignment {
		min-height: calc(2 * var(--tap-target));
	}
</style>
