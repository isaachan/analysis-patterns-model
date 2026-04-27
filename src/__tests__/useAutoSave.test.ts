import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoSave } from '../hooks/useAutoSave';

/* ------------------------------------------------------------------ */
/*  Hoisted store references                                           */
/* ------------------------------------------------------------------ */

const mockDiagramState = vi.hoisted(() => ({
  version: '1.0.0',
  metadata: { title: 'Test', createdAt: 0, updatedAt: 0 },
  elements: [] as unknown[],
}));

const fileStoreActions = vi.hoisted(() => ({
  saveCurrentFile: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Mock stores                                                        */
/* ------------------------------------------------------------------ */

vi.mock('../store/useDiagramStore', () => ({
  useDiagramStore: Object.assign(
    vi.fn((selector?: (state: unknown) => unknown) => {
      if (selector) return selector(mockDiagramState);
      return mockDiagramState;
    }),
    { getState: vi.fn(() => mockDiagramState) },
  ),
}));

vi.mock('../store/useFileStore', () => ({
  useFileStore: Object.assign(
    vi.fn(),
    { getState: vi.fn(() => fileStoreActions) },
  ),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('useAutoSave (ME-46)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockDiagramState.elements = [];
    mockDiagramState.metadata = { title: 'Test', createdAt: 0, updatedAt: 0 };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls saveCurrentFile after debounce delay on initial render', () => {
    renderHook(() => useAutoSave());

    // Before the debounce timer fires, no save should have happened
    vi.advanceTimersByTime(1999);
    expect(fileStoreActions.saveCurrentFile).not.toHaveBeenCalled();

    // After the debounce timer fires, save should be called
    vi.advanceTimersByTime(1);
    expect(fileStoreActions.saveCurrentFile).toHaveBeenCalledTimes(1);
  });

  it('calls saveCurrentFile again after debounce when metadata changes', () => {
    const { rerender } = renderHook(() => useAutoSave());

    // Let the initial save fire
    vi.advanceTimersByTime(2000);
    expect(fileStoreActions.saveCurrentFile).toHaveBeenCalledTimes(1);

    // Change metadata to a new object reference
    mockDiagramState.metadata = { title: 'Updated', createdAt: 0, updatedAt: 100 };
    rerender();

    // The new debounce timer should fire after 2000ms
    vi.advanceTimersByTime(2000);
    expect(fileStoreActions.saveCurrentFile).toHaveBeenCalledTimes(2);
  });

  it('calls saveCurrentFile again after debounce when elements change', () => {
    const { rerender } = renderHook(() => useAutoSave());

    // Let the initial save fire
    vi.advanceTimersByTime(2000);
    expect(fileStoreActions.saveCurrentFile).toHaveBeenCalledTimes(1);

    // Change elements to a new array reference
    mockDiagramState.elements = [{ id: 'el-1', type: 'type', name: 'A', attributes: [], methods: [], layout: { x: 0, y: 0, width: 100, height: 60 } }];
    rerender();

    vi.advanceTimersByTime(2000);
    expect(fileStoreActions.saveCurrentFile).toHaveBeenCalledTimes(2);
  });

  it('debounces rapid changes — only triggers one save', () => {
    const { rerender } = renderHook(() => useAutoSave());

    // Let the initial save fire
    vi.advanceTimersByTime(2000);
    expect(fileStoreActions.saveCurrentFile).toHaveBeenCalledTimes(1);

    // First change at t=2000
    mockDiagramState.elements = [{ id: 'el-1', type: 'type', name: 'A', attributes: [], methods: [], layout: { x: 0, y: 0, width: 100, height: 60 } }];
    rerender();

    // Second change halfway through debounce (t=3000)
    vi.advanceTimersByTime(1000);
    mockDiagramState.elements = [{ id: 'el-2', type: 'type', name: 'B', attributes: [], methods: [], layout: { x: 0, y: 0, width: 100, height: 60 } }];
    rerender();

    // Third change again halfway (t=4000)
    vi.advanceTimersByTime(1000);
    mockDiagramState.elements = [{ id: 'el-3', type: 'type', name: 'C', attributes: [], methods: [], layout: { x: 0, y: 0, width: 100, height: 60 } }];
    rerender();

    // Now advance past the final debounce timer (started at t=4000, so fires at t=6000)
    vi.advanceTimersByTime(2000);
    // Only second save should fire (first was at 2000, second is now at 6000)
    expect(fileStoreActions.saveCurrentFile).toHaveBeenCalledTimes(2);
  });

  it('does not call saveCurrentFile before debounce delay expires', () => {
    renderHook(() => useAutoSave());

    vi.advanceTimersByTime(500);

    expect(fileStoreActions.saveCurrentFile).not.toHaveBeenCalled();
  });

  it('cleans up timer on unmount — save does not fire after unmount', () => {
    const { unmount } = renderHook(() => useAutoSave());

    unmount();

    // Advance past the full debounce delay
    vi.advanceTimersByTime(2000);

    expect(fileStoreActions.saveCurrentFile).not.toHaveBeenCalled();
  });

  it('cleans up previous timer when a new change arrives before debounce', () => {
    const { rerender } = renderHook(() => useAutoSave());

    // Change early in the debounce window
    vi.advanceTimersByTime(500);
    mockDiagramState.elements = [{ id: 'el-1', type: 'type', name: 'A', attributes: [], methods: [], layout: { x: 0, y: 0, width: 100, height: 60 } }];
    rerender();

    // At this point the initial timer was cleared (at 500ms) and a new one started.
    // The initial timer would have fired at 2000ms, but we cancelled it at 500ms.
    // Advance to 2500ms total. Only the second timer (started at 500ms) should fire at 2500ms.
    vi.advanceTimersByTime(2000);

    // Only one save should fire — the one from the second timer
    expect(fileStoreActions.saveCurrentFile).toHaveBeenCalledTimes(1);
  });
});
