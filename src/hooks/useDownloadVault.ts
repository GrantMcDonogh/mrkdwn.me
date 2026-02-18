import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { downloadVaultAsZip } from "../utils/downloadVault";
import type { Id } from "../../convex/_generated/dataModel";

export function useDownloadVault() {
  const client = useConvex();

  async function download(vaultId: Id<"vaults">, vaultName: string) {
    const [folders, notes] = await Promise.all([
      client.query(api.folders.list, { vaultId }),
      client.query(api.notes.list, { vaultId }),
    ]);
    await downloadVaultAsZip(folders, notes, vaultName);
  }

  return download;
}
