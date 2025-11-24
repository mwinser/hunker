export type ConnectionUI = {
  show: () => Promise<string | null>
  hide: () => void
}

export function createConnectionUI(container: HTMLElement): ConnectionUI {
  let resolveConnection: ((url: string | null) => void) | null = null
  let dialog: HTMLDivElement | null = null

  const show = (): Promise<string | null> => {
    return new Promise((resolve) => {
      resolveConnection = resolve

      // Create dialog overlay
      dialog = document.createElement('div')
      dialog.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: system-ui, sans-serif;
      `

      const content = document.createElement('div')
      content.style.cssText = `
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        color: #fff;
      `

      const title = document.createElement('h2')
      title.textContent = 'Connect to Game Server'
      title.style.cssText = 'margin: 0 0 1.5rem 0; font-size: 1.5rem;'

      const form = document.createElement('div')
      form.style.cssText = 'display: flex; flex-direction: column; gap: 1rem;'

      // Manual IP input
      const ipLabel = document.createElement('label')
      ipLabel.textContent = 'Server IP Address:'
      ipLabel.style.cssText = 'display: block; margin-bottom: 0.5rem; font-weight: 500;'

      const ipInput = document.createElement('input')
      ipInput.type = 'text'
      ipInput.placeholder = '192.168.1.100 or localhost'
      ipInput.value = 'localhost'
      ipInput.style.cssText = `
        padding: 0.75rem;
        border: 1px solid #444;
        border-radius: 6px;
        background: #0a0a0a;
        color: #fff;
        font-size: 1rem;
      `

      // Port input
      const portLabel = document.createElement('label')
      portLabel.textContent = 'Port:'
      portLabel.style.cssText = 'display: block; margin-bottom: 0.5rem; font-weight: 500;'

      const portInput = document.createElement('input')
      portInput.type = 'number'
      portInput.value = '8787'
      portInput.style.cssText = `
        padding: 0.75rem;
        border: 1px solid #444;
        border-radius: 6px;
        background: #0a0a0a;
        color: #fff;
        font-size: 1rem;
      `

      // Discovery status
      const discoveryStatus = document.createElement('div')
      discoveryStatus.style.cssText = `
        padding: 1rem;
        background: #0a0a0a;
        border-radius: 6px;
        border: 1px solid #444;
        font-size: 0.9rem;
        color: #aaa;
      `
      discoveryStatus.textContent = 'Searching for servers on local network...'

      // Buttons
      const buttonContainer = document.createElement('div')
      buttonContainer.style.cssText = 'display: flex; gap: 1rem; margin-top: 1rem;'

      const connectBtn = document.createElement('button')
      connectBtn.textContent = 'Connect'
      connectBtn.style.cssText = `
        flex: 1;
        padding: 0.75rem;
        background: #646cff;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      `
      connectBtn.onmouseover = () => (connectBtn.style.background = '#535bf2')
      connectBtn.onmouseout = () => (connectBtn.style.background = '#646cff')

      const cancelBtn = document.createElement('button')
      cancelBtn.textContent = 'Cancel'
      cancelBtn.style.cssText = `
        flex: 1;
        padding: 0.75rem;
        background: #333;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      `
      cancelBtn.onmouseover = () => (cancelBtn.style.background = '#444')
      cancelBtn.onmouseout = () => (cancelBtn.style.background = '#333')

      // Connect handler
      const handleConnect = () => {
        const ip = ipInput.value.trim() || 'localhost'
        const port = portInput.value.trim() || '8787'
        const url = `ws://${ip}:${port}`
        if (resolveConnection) {
          resolveConnection(url)
          resolveConnection = null
        }
        hide()
      }

      connectBtn.onclick = handleConnect
      ipInput.onkeydown = (e) => {
        if (e.key === 'Enter') handleConnect()
      }
      portInput.onkeydown = (e) => {
        if (e.key === 'Enter') handleConnect()
      }
      cancelBtn.onclick = () => {
        if (resolveConnection) {
          resolveConnection(null)
          resolveConnection = null
        }
        hide()
      }

      // Try mDNS discovery (browser support is limited, but we can try)
      let discoveryTimeout: number | null = null
      const tryDiscovery = () => {
        // Note: Browser mDNS discovery requires WebRTC or other APIs
        // For now, we'll just show a message and let users enter IP manually
        // In the future, this could use WebRTC data channels or a discovery server
        discoveryStatus.textContent = 'Manual connection: Enter the server IP address shown on the host machine.'
        
        // Try to detect if we're on localhost and suggest that
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          discoveryStatus.textContent += ' (You can use "localhost" if running on the same machine)'
        }
      }

      tryDiscovery()

      // Assemble form
      form.appendChild(ipLabel)
      form.appendChild(ipInput)
      form.appendChild(portLabel)
      form.appendChild(portInput)
      form.appendChild(discoveryStatus)

      buttonContainer.appendChild(connectBtn)
      buttonContainer.appendChild(cancelBtn)

      content.appendChild(title)
      content.appendChild(form)
      content.appendChild(buttonContainer)

      dialog.appendChild(content)
      container.appendChild(dialog)

      // Focus input
      setTimeout(() => ipInput.focus(), 100)
    })
  }

  const hide = () => {
    if (dialog) {
      dialog.remove()
      dialog = null
    }
  }

  return { show, hide }
}

