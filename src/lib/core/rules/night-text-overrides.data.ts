/**
 * Our own Storyteller night text, used in place of TPI's when the "Full night instructions"
 * help is on (Trevor, 2026-10-15: "every first night and other night is self-sufficient to
 * describe when to use certain tokens").
 *
 * There is an entry only where TPI's text does not say on its own which reminder tokens to
 * place or remove and when, or where Trevor's review changed its wording or tokens. Text
 * uses TPI's markup: `*TOKEN*` for one of the character's reminder tokens or an info token,
 * `*DEAD*` for the death marker. It never uses `:reminder:` (it names the token instead).
 * Character names need no markup: they are always drawn as badges.
 *
 * Wording is short and our own, paraphrasing the character's wiki page
 * (`https://wiki.bloodontheclocktower.com/<Name>`); `reason` says why ours differs.
 */
import type { PlaceholderKey } from './reminder-placeholders.data.ts';

export interface NightTextOverride {
	text: string;
	/** One line: why our text differs from TPI's. */
	reason: string;
}

export const NIGHT_TEXT_OVERRIDES: Readonly<Partial<Record<PlaceholderKey, NightTextOverride>>> =
	{
		// Townsfolk
		'grandmother:first': {
			text: 'Point to the *GRANDCHILD* player & show their character token.',
			reason: 'Names the Grandchild token instead of “the grandchild player” (Trevor’s review).'
		},
		'grandmother:other': {
			text: 'If the Demon killed the *GRANDCHILD* player tonight, the Grandmother dies too: mark her *DEAD*.',
			reason: 'Says who is marked dead and when (Trevor’s review).'
		},
		'pixie:first': {
			text: 'Show the Townsfolk character token marked *MAD*. If the Pixie later gains that ability (*HAS ABILITY*), wake them when that character would wake.',
			reason: 'Says when the Has Ability token goes on and that the Pixie then wakes as that character.'
		},
		'sailor:first': {
			text: 'The Sailor chooses a living player. Either the Sailor or that player is drunk until dusk: mark them *DRUNK*.',
			reason: 'Says who gets the Drunk token and when it comes off.'
		},
		'sailor:other': {
			text: 'The Sailor chooses a living player. Either the Sailor or that player is drunk until dusk: mark them *DRUNK*.',
			reason: 'Says who gets the Drunk token and when it comes off.'
		},
		'preacher:first': {
			text: 'The Preacher chooses a player. If they chose a Minion: mark them *NO ABILITY*, put the Preacher to sleep, wake the target and show the *THIS CHARACTER SELECTED YOU* & Preacher token.',
			reason: 'No Ability goes only on a chosen Minion; “token” not “tokens” (Trevor’s review).'
		},
		'preacher:other': {
			text: 'The Preacher chooses a player. If they chose a Minion: mark them *NO ABILITY*, put the Preacher to sleep, wake the target and show the *THIS CHARACTER SELECTED YOU* & Preacher token.',
			reason: 'No Ability goes only on a chosen Minion; “token” not “tokens” (Trevor’s review).'
		},
		'villageidiot:first': {
			text: 'If there are multiple Village Idiots, mark one as *DRUNK*. Wake the Village Idiots one at a time to choose a player. Give a thumb signal.',
			reason: 'The Drunk token is named once, not again as a placeholder (Trevor’s review).'
		},
		'snakecharmer:first': {
			text: 'The Snake Charmer chooses a player. If they chose the Demon: show the *YOU ARE* & Demon tokens and give a thumbs down. Swap the Snake Charmer & Demon tokens. Put the old Snake Charmer to sleep, wake the old Demon, show the *YOU ARE* & Snake Charmer tokens and give a thumbs up. Mark the new Snake Charmer *POISONED*.',
			reason: 'Says the old Demon, now the Snake Charmer, gets the Poisoned token.'
		},
		'snakecharmer:other': {
			text: 'The Snake Charmer chooses a player. If they chose the Demon: show the *YOU ARE* & Demon tokens and give a thumbs down. Swap the Snake Charmer & Demon tokens. Put the old Snake Charmer to sleep, wake the old Demon, show the *YOU ARE* & Snake Charmer tokens and give a thumbs up. Mark the new Snake Charmer *POISONED*.',
			reason: 'Says the old Demon, now the Snake Charmer, gets the Poisoned token.'
		},
		'innkeeper:other': {
			text: 'Remove last night’s tokens. The Innkeeper chooses 2 players: mark both *SAFE* (they can’t die tonight), and mark one of them *DRUNK* until dusk.',
			reason: 'Says which token goes where and that last night’s come off.'
		},
		'gambler:other': {
			text: 'The Gambler chooses a player & a character. If the guess is wrong, the Gambler dies: mark them *DEAD*.',
			reason: 'Says when the Dead token is used (Trevor’s review).'
		},
		'acrobat:other': {
			text: 'Move *CHOSEN* to the player the Acrobat chooses. If that player is or becomes drunk or poisoned tonight, the Acrobat dies: mark them *DEAD*.',
			reason: 'Says when the Dead token is used (Trevor’s review).'
		},
		'exorcist:other': {
			text: 'The Exorcist chooses a player other than last night’s: move *CHOSEN* to them. Put the Exorcist to sleep. If they chose the Demon: wake the Demon, show the *THIS CHARACTER SELECTED YOU* & Exorcist tokens and point to the Exorcist. The Demon does not act tonight.',
			reason: 'Says the Chosen token moves each night and what it stops.'
		},
		'lycanthrope:other': {
			text: 'The Lycanthrope chooses a living player. If they are good and not marked *FAUX PAW*, they die: mark them *DEAD*, and the Demon kills no one tonight.',
			reason: 'Says when the Dead token is used (Trevor’s review: TPI’s text is not enough to use it).'
		},
		'gossip:other': {
			text: 'If the Gossip’s public statement today was true, a player dies: mark them *DEAD*.',
			reason: 'Says what makes the Gossip kill.'
		},
		'courtier:first': {
			text: 'The Courtier might choose a character. If so, that character’s player is drunk: mark them *DRUNK 3*, and mark the Courtier *NO ABILITY*.',
			reason: 'Says which token goes on whom.'
		},
		'courtier:other': {
			text: 'Count down an existing drunk token: *DRUNK 3* becomes *DRUNK 2*, *DRUNK 2* becomes *DRUNK 1*, *DRUNK 1* comes off. The Courtier might choose a character. If so, mark that character’s player *DRUNK 3*, and the Courtier *NO ABILITY*.',
			reason: 'Says how the drunk tokens count down over 3 nights and days.'
		},
		'philosopher:first': {
			text: 'The Philosopher might choose a good character. If that character is in play, its player is drunk: mark them *DRUNK*. If not, swap the Philosopher’s token for that character and mark them *IS THE PHILOSOPHER*.',
			reason: 'Says which of the two tokens applies.'
		},
		'philosopher:other': {
			text: 'The Philosopher might choose a good character. If that character is in play, its player is drunk: mark them *DRUNK*. If not, swap the Philosopher’s token for that character and mark them *IS THE PHILOSOPHER*.',
			reason: 'Says which of the two tokens applies.'
		},
		'professor:other': {
			text: 'The Professor might choose a dead player. If they do, mark the Professor *NO ABILITY*. If that player is a Townsfolk, they are resurrected: mark them *ALIVE*.',
			reason: 'Says which token goes on whom.'
		},

		// Outsiders
		'butler:first': {
			text: 'The Butler chooses a player: mark them *MASTER*.',
			reason: 'Says the Master token goes on the chosen player.'
		},
		'butler:other': {
			text: 'The Butler chooses a player: move *MASTER* to them.',
			reason: 'Says the Master token moves to tonight’s choice.'
		},

		// Minions
		'mezepheles:other': {
			text: 'If a good player said the secret word today (*TURNS EVIL*), wake them, show the *YOU ARE* info token & give a thumbs-down: they are now evil. Remove *TURNS EVIL* and mark the Mezepheles *NO ABILITY*.',
			reason: 'Says when the Turns Evil token comes off and the ability is used.'
		},
		'poisoner:other': {
			text: 'The Poisoner chooses a player: move *POISONED* to them.',
			reason: 'Says last night’s Poisoned token comes off.'
		},
		'devilsadvocate:other': {
			text: 'The Devil’s Advocate chooses a living player other than last night’s: move *SURVIVES EXECUTION* to them.',
			reason: 'Says the token moves and the same player can’t be chosen twice in a row.'
		},
		'witch:other': {
			text: 'The Witch chooses a player: move *CURSED* to them.',
			reason: 'Says last night’s Cursed token comes off.'
		},
		'cerenovus:other': {
			text: 'The Cerenovus chooses a player & a character: move *MAD* to them. Put the Cerenovus to sleep, wake the target and show the *THIS CHARACTER SELECTED YOU* token, the Cerenovus token, then the madness-character token.',
			reason: 'Says last night’s Mad token comes off.'
		},
		'harpy:other': {
			text: 'The Harpy chooses 2 players: move *MAD* to the 1st and *2ND* to the 2nd. Put the Harpy to sleep, wake the 1st target, show the *THIS CHARACTER SELECTED YOU* token and the Harpy token, then point to the 2nd target.',
			reason: 'Says which token goes on which target and that last night’s come off.'
		},
		'fearmonger:other': {
			text: 'The Fearmonger chooses a player: move *FEAR* to them. If it moved to a different player, announce that the Fearmonger has chosen a player.',
			reason: 'Says the Fear token moves to tonight’s choice.'
		},
		'assassin:other': {
			text: 'The Assassin might choose a player. If so, they die even if protected: mark them *DEAD*, and mark the Assassin *NO ABILITY*.',
			reason: 'Says which token goes on whom.'
		},
		'widow:first': {
			text: 'Show the Grimoire for as long as the Widow needs. The Widow chooses a player: mark them *POISONED*. Choose a good player: mark them *KNOW*. Put the Widow to sleep, wake the *KNOW* player and show them the Widow token.',
			reason: 'Says which token goes on whom, in the order they are placed.'
		},
		'xaan:first': {
			text: 'Mark the Xaan *NIGHT 1*. If X is 1, also mark the Xaan *X*: tonight and tomorrow, all Outsiders are poisoned.',
			reason: 'Says which night token goes on and what X does.'
		},
		'xaan:other': {
			text: 'Change the Xaan’s night token to tonight (*NIGHT 2*, *NIGHT 3*). If tonight is night X, mark the Xaan *X*: tonight and tomorrow, all Outsiders are poisoned.',
			reason: 'Says which night token goes on and what X does.'
		},
		'organgrinder:first': {
			text: 'The Organ Grinder nods to be drunk or shakes their head to be sober. Nod: mark them *DRUNK*. Shake: remove *DRUNK*.',
			reason: 'Says when the Drunk token goes on and comes off.'
		},
		'organgrinder:other': {
			text: 'The Organ Grinder nods to be drunk or shakes their head to be sober. Nod: mark them *DRUNK*. Shake: remove *DRUNK*.',
			reason: 'Says when the Drunk token goes on and comes off.'
		},

		// Demons
		'pukka:other': {
			text: 'The Pukka chooses a player: mark them *POISONED*. The player poisoned last night dies: mark them *DEAD* and remove their *POISONED*.',
			reason: 'Says the new target is poisoned and last night’s target dies, then is healthy.'
		},
		'shabaloth:other': {
			text: 'A player the Shabaloth killed last night might be resurrected: remove their *DEAD* and mark them *ALIVE*. The Shabaloth chooses 2 players: mark each *DEAD*.',
			reason: 'Says which tokens go on and come off.'
		},
		'po:other': {
			text: 'If the Po chose no one last night (*3 ATTACKS*), remove it: the Po chooses 3 players, mark each *DEAD*. Otherwise the Po may choose a player (mark them *DEAD*) or no one (mark the Po *3 ATTACKS*).',
			reason: 'Says when the 3 Attacks token goes on and comes off.'
		},
		'lleech:first': {
			text: 'The Lleech chooses a player: mark them *POISONED*. They are the Lleech’s host.',
			reason: 'Says the Poisoned token marks the host for the whole game.'
		},

		// Travellers
		'thief:other': {
			text: 'The Thief chooses a player: move *NEGATIVE VOTE* to them.',
			reason: 'Says last night’s Negative Vote token comes off.'
		},
		'bureaucrat:other': {
			text: 'The Bureaucrat chooses a player: move *3 VOTES* to them.',
			reason: 'Says last night’s 3 Votes token comes off.'
		}
	};
