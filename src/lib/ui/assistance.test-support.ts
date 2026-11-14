import { ASSIST_KEYS } from './assistance.ts';

/** Switches listed under Storyteller settings; `explainTerms` has its own Rules terms section. */
export const STORYTELLER_HELP_KEYS = ASSIST_KEYS.filter((key) => key !== 'explainTerms');
