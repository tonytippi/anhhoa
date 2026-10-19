import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Fresh module per test: install state is module-level so a page-load event is never missed.
let useInstallPrompt: typeof import('./install-prompt').useInstallPrompt;
beforeEach(async () => { vi.resetModules(); ({ useInstallPrompt } = await import('./install-prompt')); });

function Probe() {
  const { mode, install, dismiss } = useInstallPrompt('test.install');
  return <div><span data-testid="mode">{mode}</span><button onClick={() => void install()}>install</button><button onClick={dismiss}>later</button></div>;
}
const userAgent = navigator.userAgent;
afterEach(() => { cleanup(); localStorage.clear(); Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true }); });

describe('install prompt', () => {
  it('stays hidden on desktop browsers without an install event, then offers the browser dialog once it fires', async () => {
    render(<Probe />);
    expect(screen.getByTestId('mode').textContent).toBe('hidden');
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByTestId('mode').textContent).toBe('prompt');
    await act(async () => { fireEvent.click(screen.getByText('install')); });
    expect(prompt).toHaveBeenCalled();
    expect(screen.getByTestId('mode').textContent).toBe('hidden');
  });
  it('shows Share-sheet steps on iPhone and remembers "later" for a month', () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)', configurable: true });
    render(<Probe />);
    expect(screen.getByTestId('mode').textContent).toBe('ios');
    fireEvent.click(screen.getByText('later'));
    expect(screen.getByTestId('mode').textContent).toBe('hidden');
    expect(Number(localStorage.getItem('test.install'))).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);
    cleanup(); render(<Probe />);
    expect(screen.getByTestId('mode').textContent).toBe('hidden');
  });
});
