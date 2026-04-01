import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { STORAGE_KEYS } from './utils/dateUtils'

// 初期表示時のテーマ設定反映
const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
