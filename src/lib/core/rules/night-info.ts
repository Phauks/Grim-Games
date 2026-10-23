/**
 * Night information worked out from the grimoire and today's day log, so the Storyteller
 * does not have to count or remember it:
 * - answers for characters whose information depends on the day (Town Crier, Flowergirl,
 *   Undertaker, Juggler), on who is dead (Oracle) or on abilities that went wrong
 *   (Mathematician);
 * - an info picker for the first-night information characters (Washerwoman, Librarian,
 *   Investigator, Chef, Empath, Fortune Teller, Steward, Noble, Clockmaker): the truthful
 *   options;
 * - death checks for characters whose own ability kills (`night-deaths.ts`).
 *
 * Everything here is a suggestion (04-architecture.md §4: assist, never rule):
 * - `unreliable` says the waking player's ability does not work (`abilityState`: drunk,
 *   poisoned, or no ability), with every source in `impairments`, so the Storyteller may
 *   give any answer; the true answer is still worked out and shown;
 * - `mustBeFalse` says a Vortox is in play, so a Townsfolk's information must be false
 *   (https://wiki.bloodontheclocktower.com/Vortox);
 * - `misregister` lists players who might register as something else (Spy, Recluse, the
 *   Faux Paw player) and whose registration could change this information (Trevor,
 *   2026-10-17: a Recluse who isn't the Empath's neighbour is not offered); answers and
 *   pickers include every answer their registration allows, marked with the players it
 *   relies on;
 * - `why` is the logic behind a suggestion (Trevor, 2026-10-17: "show the logic"): the
 *   players the answer is worked out from, as facts (character, alignment, type), and what
 *   each relevant misregistration would change it to. Data only; the UI draws badges.
 * - `shown` is what the Storyteller recorded as shown (`RecordNightInfo`): their override;
 * - `abnormalCauses` / `answerCauses` say why a recorded answer worked abnormally, for the
 *   Mathematician.
 *
 * The answers read the *current* day log. The Storyteller clears it by hand with "New
 * day"; opening the night order never does (Trevor, 2026-10-15).
 */
export {
	MAY_MISREGISTER,
	type Reliability,
	type WhyFact,
	type WhyAlternative,
	type Why,
	type AnswerValue,
	type AbnormalUse,
	type NightAnswer,
	reliability
} from './night-info/reliability.ts';
export {
	type NightToday,
	abnormalSinceDawn,
	nightAnswer,
	answerCauses
} from './night-info/answers.ts';
export {
	type PickerKind,
	type InfoOption,
	type NumberRange,
	type InfoPicker,
	type InfoChoice,
	infoPicker,
	matchingOption,
	isTruthful,
	isAllowed,
	abnormalCauses,
	truthfulFirst,
	type ValidReason,
	type ValidInfo,
	validInformation,
	infoRecord
} from './night-info/picker.ts';
export { type NightStepInfo, nightStepInfo, withNightInfo } from './night-info/steps.ts';
