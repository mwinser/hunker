export type InputState = {
  lookDeltaX: number
  lookDeltaY: number
  moveForward: boolean
  moveBackward: boolean
  moveLeft: boolean
  moveRight: boolean
  jump: boolean
  sprint: boolean
  fire: boolean
}

export type Input = {
  state: InputState
  resetPerFrame(): void
  requestPointerLock(): void
}

export function createInput(container: HTMLElement): Input {
  const state: InputState = {
    lookDeltaX: 0,
    lookDeltaY: 0,
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    jump: false,
    sprint: false,
    fire: false,
  }

  const keyMap: Record<string, keyof InputState | null> = {
    w: 'moveForward',
    ArrowUp: 'moveForward',
    s: 'moveBackward',
    ArrowDown: 'moveBackward',
    a: 'moveLeft',
    ArrowLeft: 'moveLeft',
    d: 'moveRight',
    ArrowRight: 'moveRight',
    Shift: 'sprint',
    ' ': 'jump',
  }

  const onKey = (ev: KeyboardEvent, pressed: boolean) => {
    const key = ev.key
    const mapped = keyMap[key]
    if (mapped) {
      state[mapped] = pressed as never
      ev.preventDefault()
    }
  }

  const onMouseMove = (ev: MouseEvent) => {
    if (document.pointerLockElement === container) {
      state.lookDeltaX += ev.movementX
      state.lookDeltaY += ev.movementY
    }
  }

  const onMouseDown = (ev: MouseEvent) => {
    if (ev.button === 0) state.fire = true
  }

  container.addEventListener('click', () => container.requestPointerLock())
  window.addEventListener('keydown', (e) => onKey(e, true))
  window.addEventListener('keyup', (e) => onKey(e, false))
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mousedown', onMouseDown)

  return {
    state,
    resetPerFrame() {
      state.lookDeltaX = 0
      state.lookDeltaY = 0
      state.fire = false
    },
    requestPointerLock() {
      container.requestPointerLock()
    },
  }
}


