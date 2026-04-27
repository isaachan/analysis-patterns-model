import { useZoomPan } from '../../hooks/useZoomPan';

/* ------------------------------------------------------------------ */
/*  Inline SVG icons                                                   */
/* ------------------------------------------------------------------ */

function ZoomInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 4v4M4 6h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 6h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  ZoomControls component                                             */
/* ------------------------------------------------------------------ */

function ZoomControls() {
  const { zoom, zoomIn, zoomOut, resetView } = useZoomPan();

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-md"
      data-testid="zoom-controls"
    >
      <button
        onClick={zoomOut}
        className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-gray-600 hover:bg-gray-100 active:bg-gray-200"
        aria-label="Zoom out"
        title="Zoom out"
        data-testid="zoom-out"
      >
        <ZoomOutIcon />
      </button>
      <button
        onClick={resetView}
        className="min-w-[48px] cursor-pointer rounded-md px-1 py-1 text-center text-xs text-gray-600 hover:bg-gray-100 active:bg-gray-200"
        title="Reset zoom to 100%"
        data-testid="zoom-reset"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={zoomIn}
        className="flex h-7 w-7 items-center justify-center rounded-md text-sm text-gray-600 hover:bg-gray-100 active:bg-gray-200"
        aria-label="Zoom in"
        title="Zoom in"
        data-testid="zoom-in"
      >
        <ZoomInIcon />
      </button>
    </div>
  );
}

export default ZoomControls;
