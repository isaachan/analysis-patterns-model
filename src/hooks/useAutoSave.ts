import { useEffect, useRef } from 'react';
import useEditorStore from '../store/useEditorStore';
import {
  saveToLocalStorage,
  STORAGE_KEYS,
  estimateSize,
} from '../utils/storage';

const SAVE_DEBOUNCE_MS = 2000;
const MAX_FILE_SIZE = 500 * 1024; // 500 KB

export function useAutoSave(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  const canvasElements = useEditorStore((s) => s.canvasElements);
  const files = useEditorStore((s) => s.files);
  const currentFileId = useEditorStore((s) => s.currentFileId);
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Skip saving if nothing has changed (compare serialized snapshots)
    const snapshot = JSON.stringify({ canvasElements, files, currentFileId });
    if (snapshot === lastSavedRef.current) {
      return;
    }

    setSaveStatus('saving');

    timerRef.current = setTimeout(() => {
      // Estimate size before saving
      const estimated = estimateSize({ canvasElements, files });
      if (estimated > MAX_FILE_SIZE) {
        setSaveStatus('error', '文件大小超过 500KB 限制');
        return;
      }

      let hasError = false;

      // Save current file's canvas elements
      if (currentFileId) {
        const result = saveToLocalStorage(
          STORAGE_KEYS.FILE_DATA(currentFileId),
          canvasElements,
        );
        if (!result.success) {
          setSaveStatus('error', result.error || '保存失败');
          hasError = true;
        }
      }

      // Save files index
      if (!hasError) {
        const result = saveToLocalStorage(STORAGE_KEYS.FILES_INDEX, files);
        if (!result.success) {
          setSaveStatus('error', result.error || '保存失败');
          hasError = true;
        }
      }

      // Save current file id
      if (!hasError) {
        const result = saveToLocalStorage(
          STORAGE_KEYS.CURRENT_FILE_ID,
          currentFileId,
        );
        if (!result.success) {
          setSaveStatus('error', result.error || '保存失败');
          hasError = true;
        }
      }

      if (!hasError) {
        lastSavedRef.current = snapshot;
        setSaveStatus('saved');
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [canvasElements, files, currentFileId, setSaveStatus]);
}
