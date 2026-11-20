import type { Character } from "../data/characters";
import type { RollMode } from "../data/conditions";
import { automaticCheckFailure, resolveCheckRoll, type CheckName } from "../data/checkRolls";
import { useTableActivity } from "../data/tableActivity";
import { useDiceRoll } from "./DiceProvider";
import { useToast } from "./Toasts";

/** Rolls checks with the current dice source and reports the result in a toast, the table feed and an optional status line. */
export function useCheckRoller(character: Character, onMessage?: (text: string) => void) {
  const dice = useDiceRoll(character.updatedAt);
  const publish = useTableActivity(character.id);
  const notify = useToast();
  function report(text: string) { onMessage?.(text); publish(text); notify(text); }
  return {
    /** Rolling helpers are hidden in Paper and Tracked sheets, where dice stay at the table. */
    available: !dice.classic,
    async roll(check: CheckName, mode: RollMode) {
      if (automaticCheckFailure(character, check)) { report(`${check}: automatic failure due to condition`); return; }
      try {
        const rolled = await dice.run(check, (die) => resolveCheckRoll(character, check, mode, die));
        if (rolled) report((rolled.physical ? "Physical dice · " : "") + rolled.result);
      } catch (reason) {
        const text = reason instanceof Error ? reason.message : "Could not resolve roll.";
        onMessage?.(text); notify(text, "error");
      }
    },
  };
}
