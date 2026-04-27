import { useRef, useEffect } from 'react';
import Toolbar from './components/Toolbar/Toolbar';
import LeftSidebar from './components/LeftSidebar/LeftSidebar';
import Canvas from './components/Canvas/Canvas';
import type { CanvasHandle } from './components/Canvas/Canvas';
import RightSidebar from './components/RightSidebar/RightSidebar';
import StatusBar from './components/StatusBar/StatusBar';
import ZoomControls from './components/ZoomControls/ZoomControls';
import { useKeyboard } from './hooks/useKeyboard';
import { useAutoSave } from './hooks/useAutoSave';
import { useFileStore } from './store/useFileStore';

function App() {
  useKeyboard();
  useAutoSave();

  const canvasRef = useRef<CanvasHandle>(null);
  const loadInitialFile = useFileStore((s) => s.loadInitialFile);

  /* Load the last-opened file (or create a new one) on first mount */
  useEffect(() => {
    loadInitialFile();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 text-gray-900">
      {/* Toolbar */}
      <header className="flex h-12 shrink-0 items-center border-b border-gray-200 bg-white px-4 shadow-sm">
        <Toolbar />
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
          <LeftSidebar />
        </aside>

        {/* Canvas */}
        <main className="relative flex-1 overflow-hidden bg-gray-100">
          <Canvas ref={canvasRef} />
          <div className="absolute bottom-4 right-4 z-10">
            <ZoomControls />
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="flex w-64 shrink-0 flex-col border-l border-gray-200 bg-white">
          <RightSidebar />
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="flex h-7 shrink-0 items-center border-t border-gray-200 bg-white px-4">
        <StatusBar />
      </footer>
    </div>
  );
}

export default App;
