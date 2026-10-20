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
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import { pastNames, suggestNames } from '#lib/features/grimoire/device-notes.ts';

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
		/** Names already on other seats, left out of the names to pick from. */
		taken?: readonly string[];
		/**
		 * One token for two games (Two games at once, Trevor 2026-10-18): the other game's
		 * character, shown beside `shows`, with a label for each game.
		 */
		pair?: { shows: Character; labels: [string, string] };
		/**
		 * The locked pass-the-phone draw (Trevor, 2026-10-19): the token shows only while a
		 * finger, mouse button or Space is held on it, so a neighbour can't glance at it.
		 */
		holdToReveal?: boolean;
		onConfirm: (details: { playerName: string; alignment?: Alignment }) => void;
	}

	let {
		open = $bindable(),
		number,
		shows,
		needsAlignment,
		seatLabel,
		playerName,
		taken = [],
		pair,
		holdToReveal = false,
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
	// Names used before on this device, to pick instead of typing (Trevor, 2026-10-19).
	let past = $state<string[]>([]);
	const names = $derived(suggestNames(past, '', taken, past.length));
	let picking = $state(false);
	let alignment = $state<Alignment | ''>('');
	/** False while the player still has to type their name to see the token. */
	let revealed = $state(true);
	/** Hold to reveal: held now, and seen at least once (Confirm waits for that). */
	let held = $state(false);
	let seen = $state(false);
	$effect(() => {
		if (open) {
			name = playerName;
			past = pastNames.read();
			picking = false;
			alignment = '';
			revealed = !preferences.current.requireName || playerName.trim() !== '';
			held = false;
			seen = false;
		}
	});
	const visible = $derived(revealed && (!holdToReveal || held));
	const canConfirm = $derived(revealed && (!holdToReveal || seen));
	function hold(on: boolean) {
		held = on;
		if (on) seen = true;
	}
	// The page hidden (another app, the lock button) hides the token again.
	function onVisibility() {
		if (document.visibilityState !== 'visible') held = false;
	}

	function confirm() {
		pastNames.remember(name);
		onConfirm({ playerName: name, ...(alignment !== '' ? { alignment } : {}) });
	}

	// On a computer, Enter (outside a field or button) does the main action: Reveal, then Confirm.
	function onWindowKey(event: KeyboardEvent) {
		if (!open || event.key !== 'Enter' || event.repeat || event.defaultPrevented) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, button, a, [role="radio"]')) return;
		event.preventDefault();
		if (canConfirm) confirm();
		else if (revealed) return;
		else if (name.trim() !== '') revealed = true;
	}
</script>

<svelte:window onkeydown={onWindowKey} />
<svelte:document onvisibilitychange={onVisibility} />

<!--
	The player's own reveal. A drawn tile is never put back (Trevor, 2026-10-15): closing the
	reveal keeps it in the player's hand (the draw is saved) until it is confirmed.
-->
<Dialog bind:open title={t('setup.draw.tile', { number })} size="full">
	<div class="reveal" data-testid="reveal">
		<p class="seat">{seatLabel}</p>
		<!-- Enter keeps the name and closes the phone keyboard; Confirm stays a separate tap. -->
		<!-- The names button is always here, disabled when there are none: nothing moves. -->
		<div class="player">
			<TextField label={t('setup.reveal.name')} bind:value={name} placeholder={t('common.none')} />
			<IconButton
				icon="players"
				label={t('setup.reveal.pickName')}
				disabled={names.length === 0}
				onclick={() => (picking = true)}
			/>
		</div>
		<!-- Hidden until a name is entered when that's required; the space stays reserved. -->
		<div class="faces" class:pair={!!pair}>
			{#each faces as face, i (i)}
				<div class="face" data-testid="reveal-face">
					{#if face.label}<p class="town">{face.label}</p>{/if}
					{#if holdToReveal && revealed}
						<!-- Held down to show; let go (or lose the pointer) to hide again. -->
						<button
							type="button"
							class="token hold"
							data-testid="reveal-hold"
							aria-pressed={held}
							aria-label={t('setup.reveal.hold')}
							onpointerdown={(e) => {
								e.currentTarget.setPointerCapture?.(e.pointerId);
								hold(true);
							}}
							onpointerup={() => hold(false)}
							onpointercancel={() => hold(false)}
							onlostpointercapture={() => hold(false)}
							onkeydown={(e) => {
								if (e.key === ' ' && !e.repeat) {
									e.preventDefault();
									hold(true);
								}
							}}
							onkeyup={(e) => e.key === ' ' && hold(false)}
							onblur={() => hold(false)}
							oncontextmenu={(e) => e.preventDefault()}
						>
							{#if held}<CharacterToken
									character={face.character}
									size={pair ? 120 : 160}
								/>{:else}<span class="hidden-token">{t('setup.reveal.hold')}</span>{/if}
						</button>
					{:else}
						<div class="token">
							{#if revealed}<CharacterToken
									character={face.character}
									size={pair ? 120 : 160}
								/>{:else}<span class="hidden-token" data-testid="reveal-locked"
									>{t('setup.reveal.locked')}</span
								>{/if}
						</div>
					{/if}
					<p class="name" data-testid="reveal-name">
						{#if visible}<CharacterBadge
								characterId={face.character.id}
								character={face.character}
								alignment={defaultAlignment(face.character.type)}
								interactive={false}
							/>{/if}
					</p>
					<p class="ability" class:concealed={!visible}>
						{visible ? face.character.ability : ''}
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
			<ModalActions onConfirm={confirm} disabled={!canConfirm} />
		{:else}
			<Button variant="accent" disabled={name.trim() === ''} onclick={() => (revealed = true)}
				>{t('setup.reveal.reveal')}</Button
			>
		{/if}
	{/snippet}
</Dialog>

<BottomSheet bind:open={picking} title={t('setup.reveal.pickName')}>
	<ul class="names">
		{#each names as option (option)}
			<li>
				<button
					type="button"
					onclick={() => {
						name = option;
						picking = false;
					}}>{option}</button
				>
			</li>
		{/each}
	</ul>
</BottomSheet>

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
	 * The token keeps one size (Character token size is for the board only, Trevor 2026-10-19).
	 * The locked face is the same size, so revealing moves nothing.
	 */
	.token {
		display: grid;
		place-items: center;
		min-width: calc(10 * var(--u));
		min-height: calc(10 * var(--u));
	}
	/* The hold button is the token's own box: no button look, no text selection or callout. */
	.hold {
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		color: inherit;
		touch-action: none;
		user-select: none;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
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
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: var(--space-2);
		width: min(100%, 20rem);
		text-align: start;
	}
	.names {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.names li + li {
		border-top: 1px solid var(--border);
	}
	/* A whole-row tap, in the player font as on a seat. */
	.names button {
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font-family: var(--font-player);
		font-size: 1.1rem;
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
