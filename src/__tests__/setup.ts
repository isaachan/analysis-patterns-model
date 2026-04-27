import '@testing-library/jest-dom';
import { vi } from 'vitest';

/**
 * Mock the native `canvas` module that konva v9's Node.js entry requires.
 * When vitest resolves konva via CJS require (from react-konva), it hits
 * index-node.js -> require('canvas').  This mock prevents the crash so
 * that the browser entry alias can kick in downstream.
 *
 * This module must be defined before any Konva imports.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).canvas = {};

/**
 * Mock ResizeObserver for jsdom (used by Canvas for container resize).
 *
 * Immediately calls the callback with default test dimensions so that
 * Konva Stage renders synchronously in tests without async workarounds.
 */
globalThis.ResizeObserver = class ResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(_target: Element) {
    // Fire synchronously so the Stage renders immediately.
    this.callback(
      [{ contentRect: { width: 1024, height: 768 } as DOMRectReadOnly } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {
    /* noop */
  }
  disconnect() {
    /* noop */
  }
} as unknown as typeof ResizeObserver;

/**
 * Mock HTMLCanvasElement.getContext for Konva.
 *
 * jsdom's HTMLCanvasElement.getContext('2d') returns null, which causes
 * Konva to throw on construction. Provide a minimal mock that Konva can
 * use to build its internal node tree (actual pixel drawing is irrelevant
 * in unit tests).
 */
function createMockContext() {
  return {
    canvas: { width: 0, height: 0 },
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: () => ({
      width: 60,
      emHeightAscent: 0,
      emHeightDescent: 0,
      actualBoundingBoxAscent: 0,
      actualBoundingBoxDescent: 0,
    }),
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    bezierCurveTo: () => {},
    quadraticCurveTo: () => {},
    fill: () => {},
    stroke: () => {},
    clip: () => {},
    save: () => {},
    restore: () => {},
    scale: () => {},
    rotate: () => {},
    translate: () => {},
    transform: () => {},
    setTransform: () => {},
    setLineDash: () => {},
    getLineDash: () => [],
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    drawImage: () => {},
    getImageData: () => ({ data: [], width: 0, height: 0 }),
    putImageData: () => {},
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    font: '10px sans-serif',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    shadowBlur: 0,
    shadowColor: '#000',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    filter: 'none',
    imageSmoothingEnabled: true,
    direction: 'ltr' as CanvasDirection,
    lineDashOffset: 0,
    miterLimit: 10,
    isPointInPath: () => false,
    isPointInStroke: () => false,
    arcTo: () => {},
    ellipse: () => {},
    rect: () => {},
    createPattern: () => null,
    createImageData: () => ({ data: [], width: 0, height: 0 }),
  } as unknown as CanvasRenderingContext2D;
}

// Apply the mock before any test runs.
HTMLCanvasElement.prototype.getContext = function () {
  return createMockContext();
} as unknown as typeof HTMLCanvasElement.prototype.getContext;

/**
 * Mock URL.createObjectURL and revokeObjectURL for jsdom.
 * jsdom does not implement these APIs.
 */
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn();
}
