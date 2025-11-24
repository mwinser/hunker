import './style.css'
import { bootstrap } from './startup'

bootstrap().catch((err) => {
  console.error('Failed to bootstrap:', err)
  const appRoot = document.querySelector<HTMLDivElement>('#app')
  if (appRoot) {
    appRoot.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: #f00; font-family: system-ui; padding: 2rem;">Error: ${err.message}</div>`
  }
})