<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { InfoToken } from '#lib/core/data/info-tokens.ts';
	import type { ShowableBluffSet } from '#lib/features/bluffs/bluffs.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { plainText } from './bold.ts';
	import { pickMax } from './pick.ts';
	import InfoTokenList from './InfoTokenList.svelte';

	interface Props {
		open?: boolean;
		/** Characters the Storyteller can show with a card, in script order. */
		characters: readonly Character[];
		/**
		 * The game's bluff sets that have characters (`showableBluffSets`). Given, "These
		 * characters are not in play" shows them instead of asking for characters.
		 */
		bluffSets?: readonly ShowableBluffSet[];
		/** No bluffs chosen yet: called (with this sheet closed) to open the bluff picker. */
		onChooseBluffs?: () => void;
	}

	let { open = $bindable(false), characters, bluffSets, onChooseBluffs }: Props = $props();

	type View =
		| { kind: 'list' }
		| { kind: 'characters'; token: InfoToken }
		| { kind: 'sets'; token: InfoToken };

	let view = $state<View>({ kind: 'list' });
	let query = $state('');
	let picked = $state<CharacterId[]>([]);

	let showOpen = $state(false);
	let shown = $state<{ text: string; characterIds: CharacterId[] }>({
		text: '',
		characterIds: []
	});

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const names = (ids: readonly CharacterId[]) =>
		ids.map((id) => byId.get(id)?.name ?? id).join(', ');
	const shownCharacters = $derived(
		shown.characterIds.flatMap((id) => {
			const character = byId.get(id);
			return character ? [{ character }] : [];
		})
	);
	const title = $derived(view.kind === 'list' ? 'Info tokens' : plainText(view.token.text));

	// Each time the sheet opens it starts at the list.
	$effect(() => {
		if (!open && !showOpen) view = { kind: 'list' };
	});

	function choose(token: InfoToken) {
		if (token.id === 'not-in-play' && bluffSets) {
			if (bluffSets.length === 1) return show(token.text, bluffSets[0].characterIds);
			if (bluffSets.length > 1) {
				view = { kind: 'sets', token };
				return;
			}
			if (onChooseBluffs) {
				open = false;
				onChooseBluffs();
				return;
			}
		}
		if (token.shows === 'characters') {
			picked = [];
			view = { kind: 'characters', token };
			return;
		}
		// "This is the Demon", "These are your Minions" and the rest: the Storyteller points.
		show(token.text);
	}

	/**
	 * The player view opens on its own: the sheet closes first and comes back when the player
	 * view is closed, because the sheet hides everything outside it while open.
	 */
	function show(text: string, characterIds: readonly CharacterId[] = []) {
		shown = { text, characterIds: [...characterIds] };
		view = { kind: 'list' };
		open = false;
		showOpen = true;
	}
</script>

<BottomSheet bind:open {title} height="85dvh" focusFirstField={false}>
	<ErrorBoundary area="info-tokens">
		{#if view.kind === 'list'}
			<div class="search">
				<Icon name="search" />
				<input
					bind:value={query}
					type="search"
					aria-label="Search info tokens"
					placeholder="Search"
					autocomplete="off"
					enterkeyhint="search"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							e.currentTarget.blur();
						}
					}}
				/>
				<button
					type="button"
					class="clear"
					aria-label="Clear search"
					disabled={query === ''}
					onclick={() => (query = '')}><Icon name="close" /></button
				>
			</div>
			<InfoTokenList onchoose={choose} {query} level={3} />
		{:else if view.kind === 'characters'}
			{@const token = view.token}
			<CharacterPicker
				{characters}
				bind:selected={picked}
				max={pickMax(token.id)}
				label="Characters"
			/>
			<div class="sheet-actions">
				<Button variant="quiet" onclick={() => (view = { kind: 'list' })}>Cancel</Button>
				<Button variant="accent" icon="forward" onclick={() => show(token.text, picked)}
					>Show</Button
				>
			</div>
		{:else}
			{@const token = view.token}
			<ul class="sets" aria-label="Bluff sets">
				{#each bluffSets ?? [] as set (set.set)}
					<li>
						<button type="button" class="set" onclick={() => show(token.text, set.characterIds)}>
							<span class="set-label">{set.label}</span>
							<span class="set-names">{names(set.characterIds)}</span>
						</button>
					</li>
				{/each}
			</ul>
			<div class="sheet-actions">
				<Button variant="quiet" onclick={() => (view = { kind: 'list' })}>Cancel</Button>
			</div>
		{/if}
	</ErrorBoundary>
</BottomSheet>

<ShowToPlayer
	bind:open={showOpen}
	title={shown.text}
	characters={shownCharacters}
	onclose={() => (open = true)}
/>

<style>
	/* Lives in a sheet, so it follows the sheet's colours rather than the page's. */
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		height: var(--tap-target);
		margin-bottom: var(--space-3);
		padding-inline-start: var(--space-2);
		border-radius: var(--radius-md);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 30%, transparent);
	}
	.search:focus-within {
		box-shadow: inset 0 0 0 2px var(--focus);
	}
	.search input {
		flex: 1;
		min-width: 0;
		height: 100%;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		outline: none;
	}
	.search input::-webkit-search-cancel-button {
		appearance: none;
	}
	.clear {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.clear:disabled {
		visibility: hidden;
	}
	.sets {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.set {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.set:hover {
		background: color-mix(in srgb, currentColor 8%, transparent);
	}
	.set-label {
		font-family: var(--font-heading);
		font-size: 1.05rem;
	}
	.set-names {
		opacity: 0.85;
	}
	.sheet-actions {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		padding-top: var(--space-3);
		background: var(--sheet-background);
	}
</style>
