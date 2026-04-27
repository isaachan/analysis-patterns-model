/**
 * Multi-file localStorage persistence for the diagram editor.
 *
 * Storage layout:
 *   ame-file-index   → FileEntry[] (JSON array)
 *   ame-file-{id}    → DiagramState (JSON object)
 *   ame-current-file → string (file ID)
 */

import type { DiagramState } from '../models/diagram';
import { nanoid } from 'nanoid';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Storage key for the file index */
const INDEX_KEY = 'ame-file-index';

/** Prefix for individual file data keys */
const FILE_PREFIX = 'ame-file-';

/** Storage key for the current file ID */
const CURRENT_KEY = 'ame-current-file';

/** Default title for new files */
const DEFAULT_TITLE = 'Untitled';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Entry in the file index (lightweight metadata, no element data) */
export interface FileEntry {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/*  File Index Operations                                              */
/* ------------------------------------------------------------------ */

/**
 * Read the file index from localStorage.
 * Returns an empty array when no index exists or on error.
 */
export function getFileIndex(): FileEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FileEntry[];
  } catch (error) {
    console.error('Failed to read file index:', error);
    return [];
  }
}

/**
 * Write the file index to localStorage.
 * Silently catches and logs storage errors.
 */
export function saveFileIndex(index: FileEntry[]): boolean {
  try {
    const serialized = JSON.stringify(index);
    localStorage.setItem(INDEX_KEY, serialized);
    return true;
  } catch (error) {
    console.error('Failed to save file index:', error);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  File Data Operations                                               */
/* ------------------------------------------------------------------ */

/** Build the localStorage key for a given file ID. */
function fileKey(id: string): string {
  return FILE_PREFIX + id;
}

/**
 * Load a full diagram state for a given file ID.
 * Returns null if the file does not exist or data is corrupt.
 */
export function getFile(id: string): DiagramState | null {
  try {
    const raw = localStorage.getItem(fileKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as DiagramState;
  } catch (error) {
    console.error(`Failed to load file ${id}:`, error);
    return null;
  }
}

/**
 * Save a diagram state to localStorage under the given file ID.
 * Returns true on success, false on failure (e.g., quota exceeded).
 */
export function saveFile(id: string, state: DiagramState): boolean {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(fileKey(id), serialized);
    return true;
  } catch (error) {
    console.error(`Failed to save file ${id}:`, error);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Current File Tracking                                              */
/* ------------------------------------------------------------------ */

/** Get the ID of the last-opened file, or null. */
export function getCurrentFileId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

/** Persist the ID of the current file. */
export function setCurrentFileId(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(CURRENT_KEY);
    } else {
      localStorage.setItem(CURRENT_KEY, id);
    }
  } catch (error) {
    console.error('Failed to set current file ID:', error);
  }
}

/* ------------------------------------------------------------------ */
/*  Composite File Operations                                          */
/* ------------------------------------------------------------------ */

/**
 * Create a new empty diagram file.
 *
 * The generated title is "Untitled" or "Untitled-N" when a file with the
 * same base title already exists.
 *
 * @param title - Optional base title (defaults to "Untitled")
 * @returns The new file ID and its diagram state
 */
export function createNewFile(title?: string): { id: string; state: DiagramState } {
  const index = getFileIndex();
  const baseTitle = title || DEFAULT_TITLE;

  // Generate a unique title by appending a counter when the base title already exists
  const existingTitles = new Set(index.map((f) => f.title));
  let finalTitle = baseTitle;
  let counter = 1;
  while (existingTitles.has(finalTitle)) {
    finalTitle = `${baseTitle}-${counter}`;
    counter++;
  }

  const id = nanoid();
  const now = Date.now();
  const entry: FileEntry = {
    id,
    title: finalTitle,
    createdAt: now,
    updatedAt: now,
  };

  const state: DiagramState = {
    version: '1.0.0',
    metadata: {
      title: finalTitle,
      createdAt: now,
      updatedAt: now,
    },
    elements: [],
  };

  // Persist file data and index atomically
  saveFile(id, state);
  index.push(entry);
  saveFileIndex(index);
  setCurrentFileId(id);

  return { id, state };
}

/**
 * Delete a file and its entry from the index.
 * If the deleted file is the current file, the current file pointer is cleared.
 */
export function deleteFile(id: string): void {
  const index = getFileIndex();
  const filtered = index.filter((f) => f.id !== id);
  saveFileIndex(filtered);
  localStorage.removeItem(fileKey(id));

  if (getCurrentFileId() === id) {
    setCurrentFileId(null);
  }
}

/**
 * Rename a file in the index.
 * The new title may duplicate an existing title (files are identified by ID).
 */
export function renameFile(id: string, title: string): boolean {
  const index = getFileIndex();
  const entry = index.find((f) => f.id === id);
  if (!entry) return false;

  entry.title = title;
  entry.updatedAt = Date.now();
  return saveFileIndex(index);
}

/**
 * Remove all files and the current file pointer from localStorage.
 */
export function clearAllFiles(): void {
  try {
    const index = getFileIndex();
    for (const entry of index) {
      localStorage.removeItem(fileKey(entry.id));
    }
    localStorage.removeItem(INDEX_KEY);
    localStorage.removeItem(CURRENT_KEY);
  } catch (error) {
    console.error('Failed to clear all files:', error);
  }
}
