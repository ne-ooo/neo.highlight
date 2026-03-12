import { createContext, useContext } from "react";
import type { Grammar, Theme } from "../core/types";

interface HighlightContextValue {
  theme?: Theme | string | undefined;
  languages: Grammar[];
  classPrefix: string;
  lineNumbers: boolean;
}

const HighlightContext = createContext<HighlightContextValue>({
  languages: [],
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
  languages = [],
  classPrefix = "neo-hl",
  lineNumbers = false,
}: HighlightProviderProps) {
  return (
    <HighlightContext.Provider
      value={{ theme, languages, classPrefix, lineNumbers }}
    >
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlightContext(): HighlightContextValue {
  return useContext(HighlightContext);
}
