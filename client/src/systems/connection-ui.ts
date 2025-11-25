export type ConnectionUI = {
  show: () => Promise<{ url: string; username: string } | null>
  hide: () => void
}

export function createConnectionUI(container: HTMLElement): ConnectionUI {
  let resolveConnection: ((result: { url: string; username: string } | null) => void) | null = null
  let dialog: HTMLDivElement | null = null

  const show = (): Promise<{ url: string; username: string } | null> => {
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

      // Username input
      const usernameLabel = document.createElement('label')
      usernameLabel.textContent = 'Username:'
      usernameLabel.style.cssText = 'display: block; margin-bottom: 0.5rem; font-weight: 500;'

      const usernameInput = document.createElement('input')
      usernameInput.type = 'text'
      usernameInput.placeholder = 'Enter your username'
      usernameInput.value = `Player${Math.floor(Math.random() * 1000)}`
      usernameInput.style.cssText = `
        padding: 0.75rem;
        border: 1px solid #444;
        border-radius: 6px;
        background: #0a0a0a;
        color: #fff;
        font-size: 1rem;
      `

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

      // Server discovery function - scan all 192.168.x.x IPs
      const discoverServers = async (port: string): Promise<string | null> => {
        const testPort = parseInt(port) || 8787
        const timeout = 100 // ms per HTTP request (faster than WebSocket)

        // Get local IP hints from WebRTC (if available)
        const getLocalIPs = async (): Promise<string[]> => {
          try {
            const pc = new RTCPeerConnection({ iceServers: [] })
            const candidates: string[] = []
            
            return new Promise<string[]>((resolve) => {
              pc.onicecandidate = (event) => {
                if (event.candidate) {
                  const candidate = event.candidate.candidate
                  const match = candidate.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/)
                  if (match && match[1].startsWith('192.168.')) {
                    candidates.push(match[1])
                  }
                } else {
                  // All candidates gathered
                  resolve([...new Set(candidates)])
                }
              }
              
              pc.createDataChannel('')
              pc.createOffer().then(offer => pc.setLocalDescription(offer))
              
              // Timeout after 1 second
              setTimeout(() => {
                resolve([...new Set(candidates)])
              }, 1000)
            })
          } catch {
            return []
          }
        }

        // Test HTTP discovery endpoint (much faster than WebSocket)
        const testConnection = async (ip: string): Promise<boolean> => {
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), timeout)
            
            const response = await fetch(`http://${ip}:${testPort}/discover`, {
              method: 'GET',
              signal: controller.signal,
              mode: 'cors'
            })
            
            clearTimeout(timeoutId)
            
            if (response.ok) {
              const data = await response.json()
              return data.name === 'Hunker Game Server'
            }
            return false
          } catch {
            return false
          }
        }

        // Try localhost first (fastest)
        if (await testConnection('localhost')) {
          return 'localhost'
        }
        if (await testConnection('127.0.0.1')) {
          return '127.0.0.1'
        }

        // Get all 192.168.x.x IPs to check
        const localIPs = await getLocalIPs()
        const allIPs: string[] = []
        const subnetsToScan = new Set<number>()

        // If we found local IPs via WebRTC, use those and scan their subnets
        if (localIPs.length > 0) {
          // Extract subnets from detected IPs
          for (const ip of localIPs) {
            const parts = ip.split('.')
            if (parts.length === 4 && parts[0] === '192' && parts[1] === '168') {
              const subnet = parseInt(parts[2])
              if (!isNaN(subnet)) {
                subnetsToScan.add(subnet)
              }
            }
          }
        } else {
          // No local IPs detected, scan a reasonable range of common subnets (0-15)
          // This covers most home/office networks without being too slow
          for (let subnet = 0; subnet <= 15; subnet++) {
            subnetsToScan.add(subnet)
          }
        }

        // For each subnet to scan, add all host IPs (1-254)
        for (const subnet of subnetsToScan) {
          for (let host = 1; host <= 254; host++) {
            allIPs.push(`192.168.${subnet}.${host}`)
          }
        }

        // Remove duplicates
        const uniqueIPs = [...new Set(allIPs)]
        const subnetList = Array.from(subnetsToScan).sort((a, b) => a - b).join(', ')
        
        // Update status to show detected IPs and subnets
        if (localIPs.length > 0) {
          discoveryStatus.textContent = `Detected IPs: ${localIPs.join(', ')}\nScanning subnets: 192.168.{${subnetList}}.x\nTotal: ${uniqueIPs.length} IPs on port ${testPort}...`
        } else {
          discoveryStatus.textContent = `No local IPs detected.\nScanning subnets: 192.168.{${subnetList}}.x\nTotal: ${uniqueIPs.length} IPs on port ${testPort}...`
        }

        // Test IPs in parallel batches (HTTP is lighter, so we can do more in parallel)
        const batchSize = 50
        let tested = 0
        for (let i = 0; i < uniqueIPs.length; i += batchSize) {
          const batch = uniqueIPs.slice(i, i + batchSize)
          const results = await Promise.all(batch.map(ip => testConnection(ip)))
          tested += batch.length
          for (let j = 0; j < batch.length; j++) {
            if (results[j]) {
              // Found a server! Return immediately
              return batch[j]
            }
          }
          // Update status
          const percent = Math.round((tested / uniqueIPs.length) * 100)
          discoveryStatus.textContent = `Scanning ${uniqueIPs.length} IPs on port ${testPort}... (${tested}/${uniqueIPs.length}, ${percent}%)`
        }

        return null
      }

      // Start discovery
      const startDiscovery = async () => {
        const discoveredIP = await discoverServers(portInput.value)
        if (discoveredIP) {
          ipInput.value = discoveredIP
          discoveryStatus.textContent = `✓ Found server at ${discoveredIP}`
          discoveryStatus.style.color = '#4ade80'
        } else {
          discoveryStatus.textContent = 'No servers found. Enter server IP manually.'
          discoveryStatus.style.color = '#aaa'
        }
      }

      // Start discovery immediately
      void startDiscovery()

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
        const username = usernameInput.value.trim() || `Player${Math.floor(Math.random() * 1000)}`
        if (resolveConnection) {
          resolveConnection({ url, username })
          resolveConnection = null
        }
        hide()
      }

      connectBtn.onclick = handleConnect
      usernameInput.onkeydown = (e) => {
        if (e.key === 'Enter') handleConnect()
      }
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
      form.appendChild(usernameLabel)
      form.appendChild(usernameInput)
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
      setTimeout(() => usernameInput.focus(), 100)
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

