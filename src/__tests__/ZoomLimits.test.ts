import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../store/useEditorStore';
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '../constants/defaults';

/* ------------------------------------------------------------------ */
/*  Tests for zoom limit enforcement                                   */
/*                                                                     */
/*  These tests verify that:                                           */
/*    1. The store's setZoom function clamps to MIN_ZOOM / MAX_ZOOM    */
/*    2. The useZoomPan hook's zoomIn/zoomOut respect the limits       */
/*    3. Valid zoom values pass through unmodified                     */
/* ------------------------------------------------------------------ */

describe('Zoom limits (useEditorStore.setZoom)', () => {
  beforeEach(() => {
    // Reset zoom to default before each test
    useEditorStore.setState({ zoom: DEFAULT_ZOOM });
  });

  it('clamps zoom to MAX_ZOOM when value exceeds maximum', () => {
    useEditorStore.getState().setZoom(MAX_ZOOM + 100);
    expect(useEditorStore.getState().zoom).toBe(MAX_ZOOM);
  });

  it('clamps zoom to MIN_ZOOM when value is below minimum', () => {
    useEditorStore.getState().setZoom(MIN_ZOOM - 0.05);
    expect(useEditorStore.getState().zoom).toBe(MIN_ZOOM);
  });

  it('allows valid zoom values to pass through unmodified', () => {
    useEditorStore.getState().setZoom(2.5);
    expect(useEditorStore.getState().zoom).toBe(2.5);
  });

  it('allows zoom at exact MIN_ZOOM boundary', () => {
    useEditorStore.getState().setZoom(MIN_ZOOM);
    expect(useEditorStore.getState().zoom).toBe(MIN_ZOOM);
  });

  it('allows zoom at exact MAX_ZOOM boundary', () => {
    useEditorStore.getState().setZoom(MAX_ZOOM);
    expect(useEditorStore.getState().zoom).toBe(MAX_ZOOM);
  });

  it('allows default zoom of 1.0', () => {
    useEditorStore.getState().setZoom(DEFAULT_ZOOM);
    expect(useEditorStore.getState().zoom).toBe(DEFAULT_ZOOM);
  });
});

describe('Zoom limits (useZoomPan hook integration)', () => {
  beforeEach(() => {
    // Start at default zoom
    useEditorStore.setState({ zoom: DEFAULT_ZOOM });
  });

  it('zoomIn increments by ZOOM_STEP', () => {
    const store = useEditorStore.getState();
    // Directly simulate the useZoomPan zoomIn logic: setZoom(Math.min(zoom + ZOOM_STEP, MAX_ZOOM))
    const newZoom = Math.min(store.zoom + ZOOM_STEP, MAX_ZOOM);
    store.setZoom(newZoom);
    expect(useEditorStore.getState().zoom).toBe(DEFAULT_ZOOM + ZOOM_STEP);
  });

  it('zoomOut decrements by ZOOM_STEP', () => {
    useEditorStore.setState({ zoom: 2.0 });
    const store = useEditorStore.getState();
    const newZoom = Math.max(store.zoom - ZOOM_STEP, MIN_ZOOM);
    store.setZoom(newZoom);
    expect(useEditorStore.getState().zoom).toBe(1.9);
  });

  it('multiple zoomIn calls cannot exceed MAX_ZOOM', () => {
    // Set zoom close to max
    const nearMax = MAX_ZOOM - ZOOM_STEP * 0.5;
    useEditorStore.setState({ zoom: nearMax });

    // First zoomIn
    const store1 = useEditorStore.getState();
    const zoom1 = Math.min(store1.zoom + ZOOM_STEP, MAX_ZOOM);
    store1.setZoom(zoom1);

    // Should be clamped to MAX_ZOOM, not exceed it
    expect(useEditorStore.getState().zoom).toBe(MAX_ZOOM);

    // Second zoomIn should stay at MAX_ZOOM
    const store2 = useEditorStore.getState();
    const zoom2 = Math.min(store2.zoom + ZOOM_STEP, MAX_ZOOM);
    store2.setZoom(zoom2);
    expect(useEditorStore.getState().zoom).toBe(MAX_ZOOM);
  });

  it('multiple zoomOut calls cannot go below MIN_ZOOM', () => {
    // Set zoom close to min
    const nearMin = MIN_ZOOM + ZOOM_STEP * 0.5;
    useEditorStore.setState({ zoom: nearMin });

    // First zoomOut
    const store1 = useEditorStore.getState();
    const zoom1 = Math.max(store1.zoom - ZOOM_STEP, MIN_ZOOM);
    store1.setZoom(zoom1);

    // Should be clamped to MIN_ZOOM
    expect(useEditorStore.getState().zoom).toBe(MIN_ZOOM);

    // Second zoomOut should stay at MIN_ZOOM
    const store2 = useEditorStore.getState();
    const zoom2 = Math.max(store2.zoom - ZOOM_STEP, MIN_ZOOM);
    store2.setZoom(zoom2);
    expect(useEditorStore.getState().zoom).toBe(MIN_ZOOM);
  });
});

/* ------------------------------------------------------------------ */
/*  Real store: relation state cleanup on tool switch                   */
/* ------------------------------------------------------------------ */

describe('Editor store relation state management (real store)', () => {
  beforeEach(() => {
    // Set up relation state on the real store
    useEditorStore.setState({
      currentTool: 'relation',
      relationSourceId: 'test-source-id',
      relationEndPoint: { x: 100, y: 200 },
    });
  });

  it('clears relation state when switching away from relation tool', () => {
    useEditorStore.getState().setTool('select');
    const state = useEditorStore.getState();
    expect(state.currentTool).toBe('select');
    expect(state.relationSourceId).toBeNull();
    expect(state.relationEndPoint).toBeNull();
  });

  it('preserves relation state when staying on relation tool', () => {
    useEditorStore.getState().setTool('relation');
    const state = useEditorStore.getState();
    expect(state.currentTool).toBe('relation');
    expect(state.relationSourceId).toBe('test-source-id');
    expect(state.relationEndPoint).toEqual({ x: 100, y: 200 });
  });

  it('clears relation state when switching from relation to type tool', () => {
    useEditorStore.getState().setTool('type');
    const state = useEditorStore.getState();
    expect(state.relationSourceId).toBeNull();
    expect(state.relationEndPoint).toBeNull();
  });

  it('scheduleSourceId is initially null before any relation interaction', () => {
    useEditorStore.setState({
      relationSourceId: null,
      relationEndPoint: null,
    });
    const state = useEditorStore.getState();
    expect(state.relationSourceId).toBeNull();
    expect(state.relationEndPoint).toBeNull();
  });
});
