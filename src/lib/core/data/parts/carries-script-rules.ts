import { truePart } from './part.ts';

/**
 * It carries a script's own rules (the lines in TPI's `_meta.bootlegger`): its ability shows
 * them, and a game whose script has rules or homebrew characters starts with it in play (the
 * Bootlegger, https://wiki.bloodontheclocktower.com/Bootlegger).
 */
export const carriesScriptRules = truePart(
	'setup',
	'Carries script rules',
	"Its ability is the script's own rules, and it is in play when the script has rules or homebrew characters."
);
