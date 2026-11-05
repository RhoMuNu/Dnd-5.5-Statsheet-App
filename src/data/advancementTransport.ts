import { createContext } from "react";
import type { LevelUpPlan } from "./advancement";

export const AdvancementContext = createContext<((characterId: string, plan: LevelUpPlan, requestId: string) => Promise<void>) | null>(null);
