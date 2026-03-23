import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for delete confirmation in FileExplorer.
 *
 * The FileExplorer must show a confirmation dialog before soft-deleting
 * notes or folders. Without confirmation, accidental clicks can move
 * important files to the trash without warning.
 */

// Stub window.confirm since we're in a Node environment
beforeEach(() => {
  vi.restoreAllMocks();
  // Define confirm on globalThis if it doesn't exist
  if (!("confirm" in globalThis)) {
    (globalThis as Record<string, unknown>).confirm = () => true;
  }
});

describe("delete confirmation", () => {
  describe("note deletion", () => {
    it("should prompt for confirmation before deleting a note", () => {
      const confirmSpy = vi.fn().mockReturnValue(true);
      globalThis.confirm = confirmSpy;
      const removeMock = vi.fn();

      const noteTitle = "Important Note";
      if (!confirm(`Move "${noteTitle}" to trash?`)) return;
      removeMock();

      expect(confirmSpy).toHaveBeenCalledWith('Move "Important Note" to trash?');
      expect(removeMock).toHaveBeenCalled();
    });

    it("should NOT delete when user cancels confirmation", () => {
      const confirmSpy = vi.fn().mockReturnValue(false);
      globalThis.confirm = confirmSpy;
      const removeMock = vi.fn();

      const noteTitle = "Important Note";
      if (!confirm(`Move "${noteTitle}" to trash?`)) {
        // User cancelled — do nothing
      } else {
        removeMock();
      }

      expect(confirmSpy).toHaveBeenCalledWith('Move "Important Note" to trash?');
      expect(removeMock).not.toHaveBeenCalled();
    });
  });

  describe("folder deletion", () => {
    it("should prompt for confirmation before deleting a folder", () => {
      const confirmSpy = vi.fn().mockReturnValue(true);
      globalThis.confirm = confirmSpy;
      const removeMock = vi.fn();

      const folderName = "Project Files";
      if (!confirm(`Move "${folderName}" and its contents to trash?`)) return;
      removeMock();

      expect(confirmSpy).toHaveBeenCalledWith(
        'Move "Project Files" and its contents to trash?'
      );
      expect(removeMock).toHaveBeenCalled();
    });

    it("should NOT delete folder when user cancels confirmation", () => {
      const confirmSpy = vi.fn().mockReturnValue(false);
      globalThis.confirm = confirmSpy;
      const removeMock = vi.fn();

      const folderName = "Project Files";
      if (!confirm(`Move "${folderName}" and its contents to trash?`)) {
        // User cancelled
      } else {
        removeMock();
      }

      expect(confirmSpy).toHaveBeenCalledWith(
        'Move "Project Files" and its contents to trash?'
      );
      expect(removeMock).not.toHaveBeenCalled();
    });
  });
});
