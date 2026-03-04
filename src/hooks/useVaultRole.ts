import { useWorkspace, canEdit, isOwner } from "../store/workspace";

export function useVaultRole() {
  const [state] = useWorkspace();

  return {
    role: state.vaultRole,
    canEdit: canEdit(state),
    canManage: isOwner(state),
    canCreateNotes: canEdit(state),
    canDeleteNotes: canEdit(state),
    canEditNotes: canEdit(state),
    canManageFolders: canEdit(state),
    canDragDrop: canEdit(state),
    canDeleteVault: isOwner(state),
    canShareVault: isOwner(state),
    canRenameVault: isOwner(state),
    canPermanentDelete: isOwner(state),
  };
}
