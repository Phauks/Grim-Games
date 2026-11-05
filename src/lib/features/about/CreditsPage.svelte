<script lang="ts">
	import { AMBIENCE_MIXES } from '#lib/core/sound/ambience.ts';
	import { BOARD_SOUNDS } from '#lib/core/sound/soundboard.ts';
	import SoundCredits from '#lib/features/sound/SoundCredits.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import SectionStack from '#lib/ui/layout/SectionStack.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import OfficialNotice from './OfficialNotice.svelte';
</script>

<!-- Beneath About in the menu's App group, out of About (Trevor, 2026-10-28): the notice that
     the app is not official, with TPI's data and icons, then the recordings' sources (plan U3).
     Each credit list folds away from its header, remembered on this device (Trevor,
     2026-11-05); a new list of credits joins this stack as another collapsible section. -->
<Page title={t('shell.credits')}>
	<OfficialNotice />
	<SectionStack edge>
		<PageSection
			title={t('shell.soundCredits')}
			collapsible
			storageKey="credits-sound"
			count={AMBIENCE_MIXES.length + BOARD_SOUNDS.length}
		>
			<SoundCredits />
		</PageSection>
	</SectionStack>
</Page>
