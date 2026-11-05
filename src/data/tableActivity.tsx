import { createContext, useContext } from "react";

export const TableActivityContext = createContext<(characterId: string, summary: string) => void>(() => {});
export function useTableActivity(characterId: string) {
  const publish = useContext(TableActivityContext);
  return (summary: string) => publish(characterId, summary);
}
