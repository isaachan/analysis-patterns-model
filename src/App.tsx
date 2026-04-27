import { useEffect } from 'react';
import Toolbar from './components/Toolbar';
import LeftSidebar from './components/LeftSidebar';
import Canvas from './components/Canvas/Canvas';
import RightSidebar from './components/RightSidebar';
import StatusBar from './components/StatusBar';
import { useAutoSave } from './hooks/useAutoSave';
import useEditorStore from './store/useEditorStore';
import type { FileMeta, CanvasElement } from './store/useEditorStore';
import {
  loadFromLocalStorage,
  STORAGE_KEYS,
  loadDiagram,
} from './utils/storage';

function App() {
  // Enable auto-save
  useAutoSave();

  // On mount, restore saved state from localStorage
  useEffect(() => {
    const savedFiles = loadFromLocalStorage<FileMeta[]>(STORAGE_KEYS.FILES_INDEX);
    const savedCurrentFileId = loadFromLocalStorage<string>(STORAGE_KEYS.CURRENT_FILE_ID);

    if (savedFiles && savedFiles.length > 0 && savedCurrentFileId) {
      // Build per-file canvas data from localStorage
      const fileCanvasData: Record<string, CanvasElement[]> = {};
      for (const file of savedFiles) {
        const data = loadDiagram(file.id) as CanvasElement[] | null;
        fileCanvasData[file.id] = data || [];
      }

      const currentCanvas = fileCanvasData[savedCurrentFileId] || [];

      // Override the store's default initial state with saved data
      useEditorStore.setState({
        files: savedFiles,
        currentFileId: savedCurrentFileId,
        fileCanvasData,
        canvasElements: currentCanvas,
      });
    }
    // If no saved data, the store already initializes a default empty file.
  }, []);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <main className="flex-1 relative overflow-hidden">
          <Canvas />
        </main>
        <RightSidebar />
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
