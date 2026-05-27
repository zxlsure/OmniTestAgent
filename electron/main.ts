import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { registerAllIpcHandlers } from './ipc'
import { initDatabase } from './data/database'
import { initSecureStore } from './data/secureStore'
import { logger } from './utils/logger'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function isDev(): boolean {
  return !app.isPackaged
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      height: 40,
      symbolColor: '#333333'
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (isDev() && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  try {
    const iconPath = join(__dirname, '../resources/tray-icon.png')
    const trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) return
    tray = new Tray(trayIcon.resize({ width: 16, height: 16 }))
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Window', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
    tray.setToolTip('OmniTestAgent')
    tray.setContextMenu(contextMenu)
    tray.on('click', () => mainWindow?.show())
  } catch {
    logger.warn('Tray icon not available')
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.omnitestagent.app')

  try {
    logger.info('Initializing database...')
    await initDatabase()

    logger.info('Initializing secure store...')
    await initSecureStore()

    logger.info('Registering IPC handlers...')
    registerAllIpcHandlers()

    logger.info('Creating main window...')
    createWindow()
    createTray()

    logger.info('OmniTestAgent started successfully')
  } catch (error) {
    logger.error('Failed to start application:', error)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

export { mainWindow }
