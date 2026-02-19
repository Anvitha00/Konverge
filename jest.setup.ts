import '@testing-library/jest-dom';

class ResizeObserverMock {
    observe() { }
    unobserve() { }
    disconnect() { }
}

if (!('ResizeObserver' in globalThis)) {
    // @ts-ignore - jsdom environment
    globalThis.ResizeObserver = ResizeObserverMock;
}

if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = (() => {
        const listeners = new Set<() => void>();
        return (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: (cb: () => void) => listeners.add(cb),
            removeListener: (cb: () => void) => listeners.delete(cb),
            addEventListener: () => { },
            removeEventListener: () => { },
            dispatchEvent: () => true,
        });
    })();
}
