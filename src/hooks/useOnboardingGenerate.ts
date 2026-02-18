import { useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { ImportedFolder, ImportedNote } from "../lib/importVault";

export interface GeneratedVault {
  vaultName: string;
  folders: ImportedFolder[];
  notes: ImportedNote[];
}

export function useOnboardingGenerate() {
  const { getToken } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (
      answers: Record<string, string | string[]>
    ): Promise<GeneratedVault | null> => {
      setIsGenerating(true);
      setError(null);

      try {
        const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
        const siteUrl = convexUrl.replace(".cloud", ".site");
        const token = await getToken({ template: "convex" });

        const response = await fetch(`${siteUrl}/api/onboarding`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ answers }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText);
        }

        const data = await response.json();
        return data as GeneratedVault;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to generate vault";
        setError(message);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [getToken]
  );

  return { generate, isGenerating, error };
}
