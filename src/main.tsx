import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './i18n/config'
import './index.css'
import './components/ui/tiptap-styles.css'
import './styles/print.css'

createRoot(document.getElementById("root")!).render(
  <App />
);
