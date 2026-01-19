import { useState, useEffect } from 'react';

export function usePWAMode() {
    const [isPWAStandalone, setIsPWAStandalone] = useState(false);

    useEffect(() => {
        const checkStandalone = () => {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            const isIOSStandalone = (window.navigator as any).standalone === true;
            setIsPWAStandalone(isStandalone || isIOSStandalone);
        };

        checkStandalone();
        window.addEventListener('resize', checkStandalone); // Sometimes display-mode changes on resize in dev tools

        return () => window.removeEventListener('resize', checkStandalone);
    }, []);

    return { isPWAStandalone };
}
