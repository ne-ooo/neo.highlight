import { createContext, useContext, useMemo } from "react";
import type { Grammar, Theme } from "../core/types";

const EMPTY_LANGUAGES: Grammar[] = [];

interface HighlightContextValue {
  theme?: Theme | string | undefined;
  languages: Grammar[];
  classPrefix: string;
  lineNumbers: boolean;
}

const HighlightContext = createContext<HighlightContextValue>({
  languages: EMPTY_LANGUAGES,
  classPrefix: "neo-hl",
  lineNumbers: false,
});

export interface HighlightProviderProps {
  children: React.ReactNode;
  theme?: Theme | string;
  languages?: Grammar[];
  classPrefix?: string;
  lineNumbers?: boolean;
}

export function HighlightProvider({
  children,
  theme,
  languages = EMPTY_LANGUAGES,
  classPrefix = "neo-hl",
  lineNumbers = false,
}: HighlightProviderProps) {
  const value = useMemo(
    () => ({ theme, languages, classPrefix, lineNumbers }),
    [theme, languages, classPrefix, lineNumbers],
  );

  return (
    <HighlightContext.Provider value={value}>
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlightContext(): HighlightContextValue {
  return useContext(HighlightContext);
}
