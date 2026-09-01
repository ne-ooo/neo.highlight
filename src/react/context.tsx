import { createContext, useContext, useMemo } from "react";
import type { Grammar, Theme } from "../core/types";
import { useShallowStableArray } from "./stable-options";

const EMPTY_LANGUAGES: Grammar[] = [];

export interface HighlightContextValue {
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
  const stableLanguages = useShallowStableArray(languages) ?? EMPTY_LANGUAGES;
  const value = useMemo(
    () => ({ theme, languages: stableLanguages, classPrefix, lineNumbers }),
    [theme, stableLanguages, classPrefix, lineNumbers],
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
