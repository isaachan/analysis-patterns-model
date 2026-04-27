import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ZoomControls from '../components/ZoomControls/ZoomControls';

/* ------------------------------------------------------------------ */
/*  Mock the useZoomPan hook                                           */
/* ------------------------------------------------------------------ */

const mockZoomPan = vi.hoisted(() => ({
  zoom: 1,
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  resetView: vi.fn(),
}));

vi.mock('../hooks/useZoomPan', () => ({
  useZoomPan: vi.fn(() => mockZoomPan),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ZoomControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockZoomPan.zoom = 1;
  });

  it('renders without crashing', () => {
    const { container } = render(<ZoomControls />);
    expect(container).toBeTruthy();
  });

  it('renders zoom in, zoom out, and zoom percentage', () => {
    render(<ZoomControls />);

    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Reset zoom to 100%')).toBeInTheDocument();
  });

  it('displays 100% when zoom is 1', () => {
    render(<ZoomControls />);
    expect(screen.getByTestId('zoom-reset')).toHaveTextContent('100%');
  });

  it('displays 150% when zoom is 1.5', () => {
    mockZoomPan.zoom = 1.5;
    render(<ZoomControls />);
    expect(screen.getByTestId('zoom-reset')).toHaveTextContent('150%');
  });

  it('displays 25% when zoom is 0.25', () => {
    mockZoomPan.zoom = 0.25;
    render(<ZoomControls />);
    expect(screen.getByTestId('zoom-reset')).toHaveTextContent('25%');
  });

  it('calls zoomIn when zoom in button is clicked', async () => {
    const user = userEvent.setup();
    render(<ZoomControls />);

    await user.click(screen.getByTitle('Zoom in'));
    expect(mockZoomPan.zoomIn).toHaveBeenCalledOnce();
  });

  it('calls zoomOut when zoom out button is clicked', async () => {
    const user = userEvent.setup();
    render(<ZoomControls />);

    await user.click(screen.getByTitle('Zoom out'));
    expect(mockZoomPan.zoomOut).toHaveBeenCalledOnce();
  });

  it('calls resetView when zoom percentage is clicked', async () => {
    const user = userEvent.setup();
    render(<ZoomControls />);

    await user.click(screen.getByTestId('zoom-reset'));
    expect(mockZoomPan.resetView).toHaveBeenCalledOnce();
  });

  it('applies correct aria labels', () => {
    render(<ZoomControls />);

    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
  });
});
