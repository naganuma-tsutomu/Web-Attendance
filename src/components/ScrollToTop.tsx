import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // ウィンドウのスクロールをリセット
    window.scrollTo(0, 0);

    // main要素のスクロールをリセット
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTo(0, 0);
    }

    // Layout内の実際のスクロールコンテナ（main > div）をリセット
    const scrollContainer = document.querySelector('main > div');
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
