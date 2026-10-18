import { registerSettingsSection } from '../registry.ts';
import AboutSection from './AboutSection.svelte';
import AssistanceSection from './AssistanceSection.svelte';
import ThemeSection from './ThemeSection.svelte';
import TextSection from './TextSection.svelte';
import TokensSection from './TokensSection.svelte';
import { resets } from './resets.ts';
import IconsSection from './IconsSection.svelte';
import DataSection from './DataSection.svelte';
import BoardSection from './BoardSection.svelte';
// Feature-owned sections, registered by their own modules.
import '#lib/features/player/settings-section.ts';

// Built-in sections, grouped by topic in one list (Trevor, 2026-10-17: no audience groups;
// every Storyteller-only setting is in Storyteller settings). Other features register theirs
// the same way from their own modules.
// Theme and Text, Board and Tokens are separate sections (Trevor, 2026-10-18); each section
// has its own reset, which puts back only its own settings.
registerSettingsSection({
	id: 'theme',
	label: { key: 'settings.sectionTheme' },
	icon: 'appearance',
	component: ThemeSection,
	reset: resets.theme,
	order: 10
});
registerSettingsSection({
	id: 'text',
	label: { key: 'settings.sectionText' },
	icon: 'appearance',
	component: TextSection,
	reset: resets.text,
	order: 15
});
registerSettingsSection({
	id: 'icons',
	label: { key: 'settings.icons' },
	icon: 'icons',
	component: IconsSection,
	reset: resets.icons,
	order: 20
});
registerSettingsSection({
	// Also opened on its own from the board's menu (Trevor, 2026-10-17).
	id: 'board',
	label: { key: 'settings.sectionBoard' },
	icon: 'reminder',
	component: BoardSection,
	reset: resets.board,
	order: 30
});
registerSettingsSection({
	id: 'tokens',
	label: { key: 'settings.sectionTokens' },
	icon: 'reminder',
	component: TokensSection,
	reset: resets.tokens,
	order: 32
});
registerSettingsSection({
	id: 'assistance',
	label: { key: 'settings.storyteller' },
	icon: 'assistance',
	component: AssistanceSection,
	reset: resets.assistance,
	order: 35
});
registerSettingsSection({
	id: 'data',
	label: { key: 'settings.data' },
	icon: 'data',
	component: DataSection,
	order: 90
});
registerSettingsSection({
	id: 'about',
	label: { key: 'shell.about' },
	icon: 'about',
	component: AboutSection,
	order: 95
});
