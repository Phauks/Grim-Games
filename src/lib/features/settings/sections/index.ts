import { registerSettingsSection } from '../registry.ts';
import AssistanceSection from './AssistanceSection.svelte';
import ThemeSection from './ThemeSection.svelte';
import TextSection from './TextSection.svelte';
import TokensSection from './TokensSection.svelte';
import { resets } from './resets.ts';
import IconsSection from './IconsSection.svelte';
import DataSection from './DataSection.svelte';
import LanguageSection from './LanguageSection.svelte';
import BoardSection from './BoardSection.svelte';
import ProfilesSection from '../profiles/ProfilesSection.svelte';
import NewProfileButton from '../profiles/NewProfileButton.svelte';
// Feature-owned sections, registered by their own modules.
import '#lib/features/player/settings-section.ts';
import '#lib/features/sound/settings-section.ts';

// Built-in sections, grouped by topic in one list (Trevor, 2026-10-17: no audience groups;
// every Storyteller-only setting is in Storyteller settings). Other features register theirs
// the same way from their own modules.
// Theme and Text, Board and Tokens are separate sections (Trevor, 2026-10-18); each section
// has its own reset, which puts back only its own settings.
// Settings profiles first (plan S18): the sections marked `profile` belong to the one in use.
registerSettingsSection({
	id: 'profiles',
	label: { key: 'settings.sectionProfiles' },
	icon: 'settings',
	component: ProfilesSection,
	headingAction: NewProfileButton,
	profile: true,
	order: 5
});
registerSettingsSection({
	id: 'theme',
	label: { key: 'settings.sectionTheme' },
	icon: 'appearance',
	component: ThemeSection,
	reset: resets.theme,
	profile: true,
	order: 10
});
registerSettingsSection({
	id: 'text',
	label: { key: 'settings.sectionText' },
	icon: 'fonts',
	component: TextSection,
	reset: resets.text,
	profile: true,
	order: 15
});
registerSettingsSection({
	id: 'icons',
	label: { key: 'settings.icons' },
	icon: 'icons',
	component: IconsSection,
	reset: resets.icons,
	profile: true,
	order: 20
});
registerSettingsSection({
	// Also opened on its own from the board's menu (Trevor, 2026-10-17).
	id: 'board',
	label: { key: 'settings.sectionBoard' },
	icon: 'boardSettings',
	component: BoardSection,
	reset: resets.board,
	profile: true,
	order: 30
});
registerSettingsSection({
	id: 'tokens',
	label: { key: 'settings.sectionTokens' },
	icon: 'tokenSettings',
	component: TokensSection,
	reset: resets.tokens,
	profile: true,
	order: 32
});
registerSettingsSection({
	id: 'assistance',
	label: { key: 'settings.storyteller' },
	icon: 'assistance',
	component: AssistanceSection,
	reset: resets.assistance,
	profile: true,
	order: 35
});
registerSettingsSection({
	// The interface language, per device (Trevor, 2026-10-25: English only for now).
	id: 'language',
	label: { key: 'settings.sectionLanguage' },
	icon: 'language',
	component: LanguageSection,
	order: 80
});
registerSettingsSection({
	id: 'data',
	label: { key: 'settings.data' },
	icon: 'data',
	component: DataSection,
	order: 90
});
