<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { defaultAlignment, type Alignment, type Character } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';

	interface Props {
		open: boolean;
		/** The tile's label on the draw screen: its number or letter. */
		number: string;
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
		/**
		 * One token for two games (Two games at once, Trevor 2026-10-18): the other game's
		 * character, shown beside `shows`, with a label for each game.
		 */
		pair?: { shows: Character; labels: [string, string] };
		onConfirm: (details: { playerName: string; alignment?: Alignment }) => void;
	}

	let {
		open = $bindable(),
		number,
		shows,
		needsAlignment,
		seatLabel,
		playerName,
		pair,
		onConfirm
	}: Props = $props();
	const faces = $derived(
		pair
			? [
					{ label: pair.labels[0], character: shows },
					{ label: pair.labels[1], character: pair.shows }
				]
			: [{ label: '', character: shows }]
	);

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
		<!-- Enter keeps the name and closes the phone keyboard; Confirm stays a separate tap. -->
		<div class="player">
			<TextField label={t('setup.reveal.name')} bind:value={name} placeholder={t('common.none')} />
		</div>
		<!-- Hidden until a name is entered when that's required; the space stays reserved. -->
		<div class="faces" class:pair={!!pair}>
			{#each faces as face, i (i)}
				<div class="face" data-testid="reveal-face">
					{#if face.label}<p class="town">{face.label}</p>{/if}
					<div class="token">
						{#if revealed}<CharacterToken
								character={face.character}
								size={pair ? 120 : 160}
							/>{:else}<span class="hidden-token" data-testid="reveal-locked"
								>{t('setup.reveal.locked')}</span
							>{/if}
					</div>
					<p class="name" data-testid="reveal-name">
						{#if revealed}<CharacterBadge
								characterId={face.character.id}
								character={face.character}
								alignment={defaultAlignment(face.character.type)}
								interactive={false}
							/>{/if}
					</p>
					<p class="ability" class:concealed={!revealed}>
						{revealed ? face.character.ability : ''}
					</p>
				</div>
			{/each}
		</div>
		<div class="alignment" aria-hidden={!needsAlignment}>
			{#if needsAlignment}
				<Select
					label={t('setup.reveal.alignment')}
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
			<ModalActions onConfirm={confirm} />
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
	.faces {
		display: grid;
		gap: var(--space-3);
		justify-items: center;
	}
	.faces.pair {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-items: start;
	}
	.face {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		min-width: 0;
	}
	.town {
		margin: 0;
		font-weight: 600;
	}
	.seat {
		margin: 0;
		color: var(--on-surface-muted);
	}
	/*
	 * The token takes the user's Character token size, so its box grows with it: nothing below
	 * is ever covered. The locked face is the same size, so revealing moves nothing.
	 */
	.token {
		display: grid;
		place-items: center;
		min-width: calc(10 * var(--u) * var(--token-scale, 1));
		min-height: calc(10 * var(--u) * var(--token-scale, 1));
	}
	.hidden-token {
		display: grid;
		place-items: center;
		width: calc(10 * var(--u) * var(--token-scale, 1));
		height: calc(10 * var(--u) * var(--token-scale, 1));
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
	/* The badge's height is reserved while the token is locked. */
	.name {
		display: grid;
		place-items: center;
		min-height: var(--tap-target);
		margin: 0;
		font-size: 1.3rem;
	}
	.ability {
		max-width: 28rem;
		margin: 0;
		font-family: var(--font-ability);
	}
	.player {
		width: min(100%, 20rem);
		text-align: start;
	}
	/* A player's name is in the player font, as on their seat. */
	.player :global(.text-field input) {
		font-family: var(--font-player);
	}
	/* Space for the Traveller's alignment is always reserved, so the actions never move. */
	.alignment {
		min-height: calc(2 * var(--tap-target));
	}
</style>
