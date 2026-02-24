export declare function getVault(): Promise<{
    name: string;
    createdAt: number;
}>;
export declare function listFolders(): Promise<unknown[]>;
export declare function createFolder(name: string, parentId?: string): Promise<{
    id: string;
}>;
export declare function renameFolder(id: string, name: string): Promise<void>;
export declare function moveFolder(id: string, parentId?: string): Promise<void>;
export declare function deleteFolder(id: string): Promise<void>;
export declare function listNotes(): Promise<unknown[]>;
export declare function getNote(id: string): Promise<unknown>;
export declare function createNote(title: string, folderId?: string): Promise<{
    id: string;
}>;
export declare function updateNote(id: string, content: string): Promise<void>;
export declare function renameNote(id: string, title: string): Promise<void>;
export declare function moveNote(id: string, folderId?: string): Promise<void>;
export declare function deleteNote(id: string): Promise<void>;
export declare function searchNotes(query: string): Promise<unknown[]>;
export declare function getBacklinks(noteId: string): Promise<unknown[]>;
export declare function getUnlinkedMentions(noteId: string): Promise<unknown[]>;
