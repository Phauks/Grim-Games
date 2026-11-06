<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Alignment, Character } from '#lib/core/data/index.ts';
	import type { NightTextSegment } from '#lib/core/rules/night-text.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';

	interface Props {
		/** A night text segment other than plain text. */
		segment: Exclude<NightTextSegment, { kind: 'text' }>;
		/** The step's character, whose tokens the reminders are; none for Dusk, Dawn and the like. */
		character?: Character;
		/**
		 * Alignment of the player who has the character, when one does: its tokens are drawn in
		 * it, as on the board (a turned-evil Townsfolk's are red).
		 */
		alignment?: Alignment;
	}

	let { segment: s, character, alignment }: Props = $props();
</script>

<!-- One token, character or death marker in Storyteller night text (`NightText`, `NightTextLines`). -->
{#if s.kind === 'info'}<ReminderToken
		label={s.label}
		variant="info"
		title={t('reference.infoToken')}
	/>{:else if s.kind === 'character'}<CharacterPiece
		template="badge"
		characterId={s.id}
	/>{:else if s.kind === 'dead'}<ReminderToken
		label={t('reference.dead')}
		type={character?.type}
		{alignment}
		title={s.action === 'remove' ? t('reference.removeDeathMarker') : t('reference.deathMarker')}
	/>{:else}<ReminderToken
		label={s.label}
		{character}
		{alignment}
		done={s.prep}
		title={s.prep
			? t('reference.alreadyPlaced')
			: s.label
				? s.action === 'remove'
					? t('reference.removeToken')
					: undefined
				: t('reference.oneOf', { options: s.options.join(', ') })}
	/>{/if}
