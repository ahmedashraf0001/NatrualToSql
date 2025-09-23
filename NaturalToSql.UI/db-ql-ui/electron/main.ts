import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
const { isDev } = require('./utils.cjs')

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null
let apiProcess: ChildProcess | null = null
let ollamaInstallProcess: ChildProcess | null = null
let isOllamaInstallCancelled = false

// Function to kill any lingering Ollama processes
const killLingOllamaProcesses = async (): Promise<void> => {
  console.log('🧹 Checking for lingering Ollama processes...')
  
  return new Promise((resolve) => {
    try {
      if (require('os').platform() === 'win32') {
        const { spawn } = require('child_process')
        
        console.log('🔪 Step 1: Force killing all ollama.exe processes...')
        const killOllama = spawn('taskkill', ['/f', '/im', 'ollama.exe', '/t'], {
          stdio: 'pipe',
          windowsHide: true
        })
        
        killOllama.on('close', (killCode: number | null) => {
          console.log(`� Killed ollama.exe processes with code: ${killCode}`)
          
          // Also kill any curl processes that might be downloading
          console.log('🔪 Step 2: Killing any curl processes that might be downloading...')
          const killCurl = spawn('taskkill', ['/f', '/im', 'curl.exe', '/t'], {
            stdio: 'pipe',
            windowsHide: true
          })
          
          killCurl.on('close', (curlCode: number | null) => {
            console.log(`🔚 Killed curl processes with code: ${curlCode}`)
            
            // Finally, kill any processes with "pull" in the command line (in case Ollama spawned children)
            console.log('🔪 Step 3: Killing any processes with "pull" in command line...')
            const killPull = spawn('wmic', ['process', 'where', 'CommandLine like "%pull%"', 'delete'], {
              stdio: 'pipe',
              windowsHide: true
            })
            
            killPull.on('close', (pullCode: number | null) => {
              console.log(`🔚 Killed pull processes with code: ${pullCode}`)
              resolve()
            })
            
            killPull.on('error', () => {
              resolve() // Continue even if this fails
            })
            
            // Timeout the pull kill
            setTimeout(() => {
              resolve()
            }, 3000)
          })
          
          killCurl.on('error', () => {
            resolve() // Continue even if this fails
          })
          
          // Timeout the curl kill
          setTimeout(() => {
            resolve()
          }, 3000)
        })
        
        killOllama.on('error', (err: Error) => {
          console.log('No Ollama processes to kill:', err.message)
          resolve()
        })
        
        // Timeout the main kill operation
        setTimeout(() => {
          console.log('🕐 Ollama kill operation timed out')
          resolve()
        }, 10000)
      } else {
        resolve()
      }
    } catch (error) {
      console.error('❌ Error checking for lingering Ollama processes:', error)
      resolve()
    }
  })
}

// Helper function to forcefully terminate process and its children
const forceTerminateProcess = async (process: ChildProcess, processName: string = 'process'): Promise<void> => {
  return new Promise((resolve) => {
    if (!process || !process.pid) {
      resolve()
      return
    }

    console.log(`🔪 Force terminating ${processName} (PID: ${process.pid})`)
    
    // On Windows, use taskkill to terminate the entire process tree
    const killProcess = spawn('taskkill', ['/pid', process.pid.toString(), '/t', '/f'], {
      windowsHide: true,
      stdio: 'pipe'
    })
    
    killProcess.on('close', (code: number | null) => {
      console.log(`${processName} termination completed with code: ${code}`)
      resolve()
    })
    
    killProcess.on('error', (err) => {
      console.error(`Error terminating ${processName}:`, err)
      // Fallback to normal kill
      try {
        process.kill('SIGKILL')
      } catch (killErr) {
        console.error(`Fallback kill also failed:`, killErr)
      }
      resolve()
    })
    
    // Timeout the kill operation
    setTimeout(() => {
      console.log(`${processName} termination timeout, using fallback`)
      try {
        process.kill('SIGKILL')
      } catch (killErr) {
        console.error(`Fallback kill failed:`, killErr)
      }
      resolve()
    }, 5000)
  })
}

const createWindow = () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, '../assets/logo.ico'),
    show: false,
    frame: false, // Remove default window frame
    titleBarStyle: 'hidden', // Hide title bar
    backgroundColor: '#09090b', // Prevent white flash (matches dark theme)
    hasShadow: true, // Keep window shadow
    roundedCorners: true // Modern rounded corners on supported platforms
  })

  // Load the app
  if (isDev()) {
    mainWindow.loadURL('http://127.0.0.1:5174')
    // Open DevTools in development
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-vite/index.html'))
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Handle window state changes for the renderer
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximized', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximized', false)
  })

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

const startApiProcess = (): void => {
  // Handle both development and packaged scenarios
  let apiPath: string
  let apiDir: string
  
  if (app.isPackaged) {
    // When packaged, API files are in resources/api_publish
    apiDir = path.join(process.resourcesPath, 'api_publish')
    apiPath = path.join(apiDir, 'NaturalToQuery.Api.dll')
  } else {
    // Development mode
    apiDir = path.join(__dirname, '../api_publish')
    apiPath = path.join(apiDir, 'NaturalToQuery.Api.dll')
  }

  console.log(`Starting API from: ${apiPath}`)
  console.log(`API working directory: ${apiDir}`)
  
  try {
    // Use dotnet command to run the DLL
    apiProcess = spawn('dotnet', [apiPath], {
      cwd: apiDir,
      env: {
        ...process.env,
        'ASPNETCORE_ENVIRONMENT': app.isPackaged ? 'Production' : 'Development',
        'ASPNETCORE_URLS': 'http://localhost:5000'
      }
    })

    apiProcess.stdout?.on('data', (data) => {
      console.log(`API stdout: ${data}`)
    })

    apiProcess.stderr?.on('data', (data) => {
      console.error(`API stderr: ${data}`)
    })

    apiProcess.on('close', (code) => {
      console.log(`API process exited with code ${code}`)
    })

    apiProcess.on('error', (error) => {
      console.error('Failed to start API process:', error)
    })
  } catch (error) {
    console.error('Error starting API process:', error)
  }
}

const stopApiProcess = (): Promise<void> => {
  return new Promise((resolve) => {
    if (apiProcess) {
      console.log('Stopping API process...')
      
      // Set up a timeout to force kill if graceful shutdown takes too long
      const forceKillTimeout = setTimeout(() => {
        if (apiProcess) {
          console.log('Force killing API process...')
          apiProcess.kill('SIGKILL')
          apiProcess = null
        }
        resolve()
      }, 5000) // 5 second timeout
      
      // Listen for the process to actually exit
      apiProcess.once('exit', () => {
        console.log('API process stopped gracefully')
        clearTimeout(forceKillTimeout)
        apiProcess = null
        resolve()
      })
      
      // Try graceful shutdown first
      apiProcess.kill('SIGTERM')
    } else {
      console.log('No API process to stop')
      resolve()
    }
  })
}

const stopOllamaProcess = async (): Promise<void> => {
  try {
    const { promisify } = require('util')
    const execAsync = promisify(require('child_process').exec)
    
    console.log('Stopping Ollama model (leaving GUI running)...')
    
    try {
      // Check if any models are currently running
      const { stdout: psOutput } = await execAsync('ollama ps', { timeout: 5000 })
      console.log('Current running models:', psOutput)
      
      if (psOutput.includes('qwen3:8b')) {
        console.log('Stopping qwen3:8b model...')
        // Stop the specific model without affecting the Ollama service or GUI
        await execAsync('ollama stop qwen3:8b', { timeout: 10000 })
        console.log('qwen3:8b model stopped successfully')
      } else {
        console.log('No qwen3:8b model running')
      }
      
    } catch (error) {
      console.log('Error stopping model or no models running:', error)
    }
    
    console.log('Ollama model cleanup completed (GUI and service left running)')
    
  } catch (error) {
    console.error('Error during Ollama model cleanup:', error)
  }
}

// Ollama Installation and Management
ipcMain.handle('check-ollama-status', async () => {
  try {
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(exec)
    
    console.log('Starting Ollama status check...')
    
    // Check if ollama command exists
    try {
      console.log('Checking if Ollama is installed...')
      await execAsync('ollama --version', { timeout: 10000 })
      console.log('Ollama is installed')
      
      // Check if qwen3:8b model is available
      try {
        console.log('Checking installed models...')
        const { stdout } = await execAsync('ollama list', { timeout: 10000 })
        console.log('Ollama list output:', stdout)
        const hasQwen = stdout.includes('qwen3:8b')
        
        if (hasQwen) {
          // Check if the model is currently running
          try {
            console.log('Checking running models...')
            const { stdout: psOutput } = await execAsync('ollama ps', { timeout: 10000 })
            console.log('Ollama ps output:', psOutput)
            const isModelRunning = psOutput.includes('qwen3:8b')
            
            return {
              ollamaInstalled: true,
              modelInstalled: true,
              modelRunning: isModelRunning,
              status: isModelRunning ? 'running' : 'ready'
            }
          } catch (error) {
            console.log('Error checking running models, assuming not running:', error)
            // If 'ollama ps' fails, model is not running
            return {
              ollamaInstalled: true,
              modelInstalled: true,
              modelRunning: false,
              status: 'ready'
            }
          }
        } else {
          console.log('qwen3:8b model not found in installed models')
          return {
            ollamaInstalled: true,
            modelInstalled: false,
            modelRunning: false,
            status: 'model-missing'
          }
        }
      } catch (error) {
        console.log('Error checking models, Ollama service might not be running:', error)
        return {
          ollamaInstalled: true,
          modelInstalled: false,
          modelRunning: false,
          status: 'ollama-not-running'
        }
      }
    } catch (error) {
      console.log('Ollama is not installed:', error)
      return {
        ollamaInstalled: false,
        modelInstalled: false,
        modelRunning: false,
        status: 'not-installed'
      }
    }
  } catch (error: any) {
    console.error('Error checking Ollama status:', error)
    return {
      ollamaInstalled: false,
      modelInstalled: false,
      modelRunning: false,
      status: 'error',
      error: error.message
    }
  }
})

// Enhanced LLM health check that verifies both API and model availability
ipcMain.handle('check-local-llm-health', async () => {
  try {
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(exec)
    
    console.log('🔍 Starting comprehensive Local LLM health check...')
    
    // Step 1: Check if Ollama is installed
    try {
      console.log('📋 Checking if Ollama is installed...')
      const { stdout: versionOutput } = await execAsync('ollama --version', { timeout: 10000 })
      console.log('✅ Ollama is installed. Version:', versionOutput.trim())
    } catch (error: any) {
      console.log('❌ Ollama is not installed. Error:', error.message || error)
      return {
        status: 'error',
        healthy: false,
        message: 'Ollama is not installed. Please install Ollama to use local LLM features.',
        checks: {
          ollamaInstalled: false,
          ollamaApiRunning: false,
          modelAvailable: false,
          modelRunning: false
        }
      }
    }
    
    // Step 2: Check if Ollama API is responding (passive check only)
    try {
      console.log('🌐 Checking if Ollama API is responding...')
      
      // Passive check - do not try to start the service automatically
      // This ensures health check reports actual state, not modified state
      await execAsync('ollama list', { timeout: 5000 })
      console.log('✅ Ollama API is responding')
      
    } catch (error: any) {
      console.log('❌ Ollama API is not responding:', error)
      
      // Additional passive check with curl to be thorough
      try {
        await execAsync('curl -f http://localhost:11434/api/tags --connect-timeout 3', { timeout: 5000 })
        console.log('✅ Ollama API is responding (curl test successful)')
      } catch (curlError) {
        console.log('❌ Ollama API is not responding via curl either:', curlError)
        return {
          status: 'error',
          healthy: false,
          message: 'Ollama service is not running or not responding',
          checks: {
            ollamaInstalled: true,
            ollamaApiRunning: false,
            modelAvailable: false,
            modelRunning: false
          }
        }
      }
    }
    
    // Step 3: Check if qwen3:8b model is available
    try {
      console.log('🤖 Checking if qwen3:8b model is available...')
      const { stdout: modelsOutput } = await execAsync('ollama list', { timeout: 10000 })
      console.log('📋 Available models output:', modelsOutput.substring(0, 200) + '...')
      
      // More robust model detection - check for the model name in different formats
      const modelPatterns = [
        /qwen3:8b/i,
        /qwen3\.5:8b/i,
        /qwen3\s+8b/i,
        /qwen3:8b-instruct/i
      ]
      
      const hasQwen = modelPatterns.some(pattern => pattern.test(modelsOutput))
      
      if (!hasQwen) {
        console.log('❌ qwen3:8b model not found in available models')
        console.log('Available models output:', modelsOutput)
        return {
          status: 'error',
          healthy: false,
          message: 'qwen3:8b model is not installed',
          checks: {
            ollamaInstalled: true,
            ollamaApiRunning: true,
            modelAvailable: false,
            modelRunning: false
          }
        }
      }
      console.log('✅ qwen3:8b model is available')
      
      // Step 4: Check if the model is currently loaded/running
      try {
        console.log('🏃 Checking if qwen3:8b model is currently running...')
        const { stdout: runningOutput } = await execAsync('ollama ps', { timeout: 10000 })
        console.log('🏃 Running models output:', runningOutput)
        
        // More robust running model detection
        const isModelRunning = modelPatterns.some(pattern => pattern.test(runningOutput))
        
        if (isModelRunning) {
          return {
            status: 'healthy',
            healthy: true,
            message: 'Local LLM is fully operational',
            checks: {
              ollamaInstalled: true,
              ollamaApiRunning: true,
              modelAvailable: true,
              modelRunning: true
            }
          }
        } else {
          // Model is available but not running - this is a warning state
          return {
            status: 'warning',
            healthy: false,
            message: 'qwen3:8b model is available but not currently loaded. Model will load automatically on first use.',
            checks: {
              ollamaInstalled: true,
              ollamaApiRunning: true,
              modelAvailable: true,
              modelRunning: false
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Could not check running models, but model is available. Error:', error)
        // If we can't check running status, that's also a problem
        return {
          status: 'error',
          healthy: false,
          message: 'Could not check if model is running. Ollama may be experiencing issues.',
          checks: {
            ollamaInstalled: true,
            ollamaApiRunning: true,
            modelAvailable: true,
            modelRunning: false
          }
        }
      }
    } catch (error: any) {
      console.log('❌ Error checking available models:', error)
      return {
        status: 'error',
        healthy: false,
        message: `Could not verify model availability: ${error.message || 'Unknown error'}`,
        checks: {
          ollamaInstalled: true,
          ollamaApiRunning: true,
          modelAvailable: false,
          modelRunning: false
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Error during Local LLM health check:', error)
    return {
      status: 'error',
      healthy: false,
      message: `Health check failed: ${error.message}`,
      checks: {
        ollamaInstalled: false,
        ollamaApiRunning: false,
        modelAvailable: false,
        modelRunning: false
      }
    }
  }
})

ipcMain.handle('install-ollama-setup', async (event) => {
  console.log('🎯 IPC Handler: install-ollama-setup called!')
  console.log('🚀 Starting Ollama installation process...')
  
  // Reset cancellation flag
  isOllamaInstallCancelled = false
  ollamaInstallProcess = null
  
  try {
    const { spawn } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(require('child_process').exec)
    
    // Function to send progress updates with enhanced detail including time estimates
    const sendProgress = (step: string, message: string, progress: number, subProgress?: number, totalSize?: string, cancellable: boolean = false, timeEstimate?: string, downloadSpeed?: string) => {
      console.log(`📊 Progress: ${step} - ${message} (${progress}%)${timeEstimate ? ` - ETA: ${timeEstimate}` : ''}${downloadSpeed ? ` - Speed: ${downloadSpeed}` : ''}`)
      
      const progressData = { 
        step, 
        message, 
        progress,
        subProgress,
        totalSize,
        cancellable,
        timeEstimate,
        downloadSpeed,
        timestamp: Date.now()
      };
      
      console.log('🚀 SENDING PROGRESS EVENT:', JSON.stringify(progressData, null, 2));
      event.sender.send('ollama-install-progress', progressData);
      
      // Also send global download event
      event.sender.send('global-download-progress', {
        id: 'ollama-setup',
        title: 'Ollama Setup',
        description: message,
        progress,
        size: totalSize,
        downloadSpeed,
        timeEstimate,
        status: progress >= 100 ? 'completed' : 'downloading',
        cancellable
      })
    }
    
    console.log('🔍 Checking system requirements...')
    sendProgress('checking', '🔍 Checking system requirements...', 5)
    
    // Check if winget exists
    let hasWinget = true
    try {
      console.log('🔍 Checking for winget...')
      const wingetResult = await execAsync('winget --version')
      console.log('✅ Winget found:', wingetResult.stdout?.trim())
      sendProgress('checking', '✅ Windows Package Manager (winget) found', 10, undefined, undefined, false, undefined, undefined)
    } catch (error: any) {
      hasWinget = false
      console.log('⚠️  Winget not found:', error?.message || error)
      sendProgress('checking', '⚠️  Windows Package Manager (winget) not found', 10, undefined, undefined, false, undefined, undefined)
    }
    
    if (!hasWinget) {
      console.log('🔧 Installing Windows Package Manager...')
      sendProgress('winget', '📦 Installing Windows Package Manager (winget)...', 15, 0, '~50MB', false, '2-3 minutes', undefined)
      
      // Install winget via PowerShell (hidden window)
      const wingetScript = `
        $ProgressPreference = 'SilentlyContinue'
        $wingetUrl = "https://aka.ms/getwinget"
        $wingetInstaller = "$env:TEMP\\AppInstaller.msixbundle"
        Write-Host "Downloading App Installer..."
        Invoke-WebRequest -Uri $wingetUrl -OutFile $wingetInstaller
        Write-Host "Installing App Installer..."
        Add-AppxPackage -Path $wingetInstaller
        Write-Host "Installation complete"
      `
      
      console.log('📜 Starting PowerShell script for winget installation...')
      await new Promise<void>((resolve, reject) => {
        const ps = spawn('powershell.exe', ['-Command', wingetScript], {
          windowsHide: true,
          stdio: 'pipe'
        })
        
        let wingetProgress = 0
        
        ps.stdout?.on('data', (data: Buffer) => {
          const output = data.toString()
          console.log('📤 Winget install stdout:', output)
          
          if (output.includes('Downloading')) {
            wingetProgress = 25
            console.log('⬇️  Downloading App Installer package...')
            sendProgress('winget', '⬇️  Downloading App Installer package...', 20, wingetProgress, '~50MB', false, '1-2 minutes', undefined)
          } else if (output.includes('Installing')) {
            wingetProgress = 75
            console.log('⚙️  Installing App Installer...')
            sendProgress('winget', '⚙️  Installing App Installer...', 25, wingetProgress, '~50MB', false, '30-60 seconds', undefined)
          } else if (output.includes('complete')) {
            wingetProgress = 100
            console.log('✅ App Installer installed successfully')
            sendProgress('winget', '✅ App Installer installed successfully', 30, wingetProgress, '~50MB', false, 'Complete', undefined)
          }
        })
        
        ps.stderr?.on('data', (data: Buffer) => {
          const output = data.toString()
          console.log('⚠️  Winget install stderr:', output)
        })
        
        ps.on('close', (code: number | null) => {
          console.log(`🔚 Winget installation process closed with code: ${code}`)
          if (code === 0) {
            sendProgress('winget', '✅ Windows Package Manager ready', 30, 100, '~50MB', false, 'Complete', undefined)
            resolve()
          } else {
            reject(new Error(`Winget installation failed with code ${code}`))
          }
        })
        
        ps.on('error', (err: any) => {
          console.error('❌ Winget installation error:', err)
          reject(err)
        })
      })
    } else {
      console.log('✅ Winget already available, skipping installation')
      sendProgress('winget', '✅ Windows Package Manager ready', 30, undefined, undefined, false, 'Complete', undefined)
    }
    
    // Check if Ollama is already installed before attempting installation
    console.log('🔍 Checking if Ollama is already installed...')
    let ollamaAlreadyInstalled = false
    try {
      const { stdout: versionCheck } = await execAsync('ollama --version', { timeout: 5000 })
      console.log('✅ Ollama is already installed:', versionCheck.trim())
      ollamaAlreadyInstalled = true
      sendProgress('ollama', '✅ Ollama application already installed', 55, 100, 'Ready', false, 'Complete', undefined)
    } catch (error) {
      console.log('ℹ️ Ollama not yet installed, proceeding with installation...')
      ollamaAlreadyInstalled = false
    }
    
    if (!ollamaAlreadyInstalled) {
      console.log('🤖 Starting Ollama installation via winget...')
      sendProgress('ollama', '📦 Installing Ollama application...', 35, 0, '~150MB', true, '3-5 minutes', undefined)
      
      // Try winget installation first, with fallback to direct download if it fails
      try {
      await new Promise<void>((resolve, reject) => {
        // Check for cancellation before starting
        if (isOllamaInstallCancelled) {
          reject(new Error('Installation cancelled by user'))
          return
        }
        
        console.log('🏃 Executing winget install command for Ollama...')
        const winget = spawn('winget', [
          'install', '--id', 'Ollama.Ollama', '-e', 
          '--accept-source-agreements', '--accept-package-agreements'
        ], {
          windowsHide: true,
          stdio: 'pipe'
        })
        
        // Track the process for cancellation
        ollamaInstallProcess = winget
        
        let ollamaProgress = 0
        let downloadStarted = false
        let progressTimer: NodeJS.Timeout | null = null
        let timeoutTimer: NodeJS.Timeout | null = null
        let lastOutputTime = Date.now()
        let lastReportedProgress = -1 // Track last reported progress to avoid spam
        let downloadStartTime = Date.now()
        let lastSizeUpdate = 0
        let lastSizeTime = Date.now()
        let progressStuckTimer: NodeJS.Timeout | null = null
        
        // Enhanced progress timer with better fallback logic
        const startProgressTimer = () => {
          if (progressTimer) clearInterval(progressTimer)
          
          // More aggressive progress updates when stuck
          progressTimer = setInterval(() => {
            const timeSinceLastOutput = Date.now() - lastOutputTime
            
            // If download started but we haven't seen progress in 5 seconds, force small increments
            if (downloadStarted && timeSinceLastOutput > 5000) {
              const artificialProgress = Math.min(ollamaProgress + 0.5, 15) // Very slow artificial progress
              if (artificialProgress > ollamaProgress) {
                ollamaProgress = artificialProgress
                console.log(`🕐 Forcing progress update due to no output for ${Math.round(timeSinceLastOutput/1000)}s: ${ollamaProgress}%`)
                sendProgress('ollama', '⬇️  Downloading Ollama installer... (network may be slow)', 40, ollamaProgress, '~150MB', true, undefined, undefined)
              }
            }
          }, 1000) // Check every 1 second for better responsiveness
        }
        
        const stopProgressTimer = () => {
          if (progressTimer) {
            clearInterval(progressTimer)
            progressTimer = null
          }
          if (progressStuckTimer) {
            clearTimeout(progressStuckTimer)
            progressStuckTimer = null
          }
        }
        
        // More lenient timeout with better detection
        const resetTimeout = () => {
          if (timeoutTimer) clearTimeout(timeoutTimer)
          timeoutTimer = setTimeout(() => {
            const timeSinceLastOutput = Date.now() - lastOutputTime
            console.error(`❌ Winget process appears to be hanging - no output for ${Math.round(timeSinceLastOutput/1000)} seconds`)
            
            // If we're past 20% progress, be more patient
            const timeoutDuration = ollamaProgress > 20 ? 90000 : 60000 // 90s vs 60s
            
            if (timeSinceLastOutput > timeoutDuration) {
              console.log('🔧 Attempting to kill hanging winget process...')
              stopProgressTimer()
              try {
                winget.kill('SIGKILL')
              } catch (err) {
                console.error('Error killing winget process:', err)
              }
              reject(new Error('Winget installation timed out - process appeared to hang'))
            } else {
              // Reset for another check
              resetTimeout()
            }
          }, 20000) // Check every 20 seconds
        }
        
        resetTimeout() // Start initial timeout
      
      winget.stdout?.on('data', (data: Buffer) => {
        // Check for cancellation
        if (isOllamaInstallCancelled) {
          reject(new Error('Installation cancelled by user'))
          return
        }
        
        const output = data.toString()
        lastOutputTime = Date.now()
        resetTimeout() // Reset timeout when we get output
        console.log('📤 Ollama install stdout:', output.trim())
        
        // ENHANCED PROGRESS PARSING - Multiple patterns with fallbacks
        let progressDetected = false
        
        // Pattern 1: "161 MB / 672 MB" (most reliable)
        const downloadMatch = output.match(/(\d+(?:\.\d+)?)\s*MB\s*\/\s*(\d+(?:\.\d+)?)\s*MB/)
        if (downloadMatch) {
          const downloaded = parseFloat(downloadMatch[1])
          const total = parseFloat(downloadMatch[2])
          const realProgress = Math.round((downloaded / total) * 100)
          
          if (realProgress >= 0 && realProgress <= 100 && realProgress !== lastReportedProgress) {
            ollamaProgress = realProgress
            lastReportedProgress = realProgress
            progressDetected = true
            
            // Calculate speed and time estimates
            const currentTime = Date.now()
            const timeSinceLastUpdate = (currentTime - lastSizeTime) / 1000
            let downloadSpeed = ''
            let timeEstimate = ''
            
            if (timeSinceLastUpdate > 0.5) { // More frequent updates
              const downloadedMB = downloaded - lastSizeUpdate
              if (downloadedMB > 0) {
                const speedMBps = downloadedMB / timeSinceLastUpdate
                downloadSpeed = speedMBps > 1 ? `${speedMBps.toFixed(1)} MB/s` : `${(speedMBps * 1024).toFixed(0)} KB/s`
                
                const remainingMB = total - downloaded
                const remainingSeconds = remainingMB / speedMBps
                timeEstimate = remainingSeconds < 60 ? `${Math.round(remainingSeconds)}s` : `${Math.round(remainingSeconds / 60)}m`
                
                lastSizeUpdate = downloaded
                lastSizeTime = currentTime
              }
            }
            
            console.log(`📊 Progress detected (MB/MB): ${downloaded}/${total}MB (${realProgress}%)`)
            const totalProgress = Math.min(35 + (realProgress * 0.2), 55)
            const downloadedDisplay = downloaded < 1024 ? `${downloaded.toFixed(0)}MB` : `${(downloaded / 1024).toFixed(1)}GB`
            const totalDisplay = total < 1024 ? `${total.toFixed(0)}MB` : `${(total / 1024).toFixed(1)}GB`
            
            sendProgress('ollama', `⬇️  Downloading Ollama: ${realProgress}%`, totalProgress, realProgress, `${downloadedDisplay} / ${totalDisplay}`, true, timeEstimate, downloadSpeed)
            stopProgressTimer()
          }
        }
        
        // Pattern 2: Progress bars like "████████▎ 40%" or "██▓▒░ 25%"
        if (!progressDetected) {
          const progressBarMatch = output.match(/[█▓▒░\-=\|\\\/]{3,}\s*(\d+(?:\.\d+)?)%/)
          if (progressBarMatch) {
            const realProgress = Math.round(parseFloat(progressBarMatch[1]))
            if (realProgress >= 0 && realProgress <= 100 && Math.abs(realProgress - lastReportedProgress) >= 1) {
              ollamaProgress = realProgress
              lastReportedProgress = realProgress
              progressDetected = true
              
              console.log(`📊 Progress detected (progress bar): ${realProgress}%`)
              const totalProgress = Math.min(35 + (realProgress * 0.2), 55)
              sendProgress('ollama', `⬇️  Downloading Ollama: ${realProgress}%`, totalProgress, realProgress, '~150MB', true)
              stopProgressTimer()
            }
          }
        }
        
        // Pattern 3: Simple percentage like "25%" or "downloading... 40%"
        if (!progressDetected) {
          const percentMatch = output.match(/(?:downloading|progress|completed?).*?(\d+(?:\.\d+)?)%|(\d+(?:\.\d+)?)%/)
          if (percentMatch) {
            const realProgress = Math.round(parseFloat(percentMatch[1] || percentMatch[2]))
            if (realProgress >= 0 && realProgress <= 100 && Math.abs(realProgress - lastReportedProgress) >= 2) { // Require 2% difference for simple patterns
              ollamaProgress = realProgress
              lastReportedProgress = realProgress
              progressDetected = true
              
              console.log(`📊 Progress detected (percentage): ${realProgress}%`)
              const totalProgress = Math.min(35 + (realProgress * 0.2), 55)
              sendProgress('ollama', `⬇️  Downloading Ollama: ${realProgress}%`, totalProgress, realProgress, '~150MB', true)
              stopProgressTimer()
            }
          }
        }
        
        // Status indicators and phase detection
        if (output.includes('Found') || output.includes('Version') || output.includes('Selecting')) {
          if (lastReportedProgress < 5) {
            lastReportedProgress = 5
            sendProgress('ollama', '📋 Found Ollama package...', 37, 5, '~150MB')
          }
        } else if (output.includes('Agreement') || output.includes('License')) {
          if (lastReportedProgress < 8) {
            lastReportedProgress = 8
            sendProgress('ollama', '📜 Processing license agreements...', 38, 8, '~150MB')
          }
        } else if (output.includes('Downloading') || output.match(/[-\\|\/]/) || output.includes('Retrieving')) {
          if (!downloadStarted) {
            downloadStarted = true
            downloadStartTime = Date.now()
            console.log('🌐 Download phase detected')
            sendProgress('ollama', '⬇️  Starting Ollama download...', 40, ollamaProgress, '~150MB', true)
            startProgressTimer() // Start fallback timer only when download begins
          }
        } else if (output.includes('Installing') || output.includes('Successfully installed')) {
          stopProgressTimer()
          if (lastReportedProgress < 90) {
            ollamaProgress = 90
            lastReportedProgress = 90
            sendProgress('ollama', '⚙️  Installing Ollama application...', 50, 90, '~150MB')
          }
        } else if (output.includes('No packages found')) {
          console.error('❌ Ollama package not found in winget repository')
          stopProgressTimer()
          reject(new Error('Ollama package not found in winget repository'))
        } else if (output.includes('Failed') || output.includes('Error')) {
          console.error('❌ Winget installation error detected:', output.trim())
          stopProgressTimer()
          reject(new Error(`Winget installation failed: ${output.trim()}`))
        }
      })
      
      winget.stderr?.on('data', (data: Buffer) => {
        // Check for cancellation
        if (isOllamaInstallCancelled) {
          reject(new Error('Installation cancelled by user'))
          return
        }
        
        const output = data.toString()
        lastOutputTime = Date.now()
        resetTimeout() // Reset timeout when we get output
        console.log('⚠️  Ollama install stderr:', output.trim())
        
        // Enhanced stderr parsing - look for multiple progress patterns
        let progressDetected = false
        
        // Pattern 1: Winget download progress "X% downloaded" or "downloaded X%"
        const percentMatch = output.match(/(?:downloaded\s+|downloading\s+)?(\d+(?:\.\d+)?)%/i)
        if (percentMatch) {
          const realProgress = Math.round(parseFloat(percentMatch[1]))
          
          if (realProgress >= 0 && realProgress <= 100 && Math.abs(realProgress - lastReportedProgress) >= 2) {
            ollamaProgress = realProgress
            lastReportedProgress = realProgress
            progressDetected = true
            
            console.log(`📊 Progress detected in stderr (percentage): ${realProgress}%`)
            const totalProgress = Math.min(35 + (realProgress * 0.2), 55)
            sendProgress('ollama', `⬇️  Downloading Ollama: ${realProgress}%`, totalProgress, realProgress, '~150MB', true)
            stopProgressTimer()
          }
        }
        
        // Pattern 2: Winget byte progress "X MB / Y MB" or "X.Y MB of Y.Z MB"
        if (!progressDetected) {
          const downloadMatch = output.match(/(\d+(?:\.\d+)?)\s*MB\s*(?:\/|of)\s*(\d+(?:\.\d+)?)\s*MB/i)
          if (downloadMatch) {
            const downloaded = parseFloat(downloadMatch[1])
            const total = parseFloat(downloadMatch[2])
            const realProgress = Math.round((downloaded / total) * 100)
            
            if (realProgress >= 0 && realProgress <= 100 && Math.abs(realProgress - lastReportedProgress) >= 2) {
              ollamaProgress = realProgress
              lastReportedProgress = realProgress
              progressDetected = true
              
              console.log(`📊 Progress detected in stderr (MB/MB): ${downloaded}/${total}MB (${realProgress}%)`)
              const totalProgress = Math.min(35 + (realProgress * 0.2), 55)
              const downloadedDisplay = downloaded < 1024 ? `${downloaded.toFixed(0)}MB` : `${(downloaded / 1024).toFixed(1)}GB`
              const totalDisplay = total < 1024 ? `${total.toFixed(0)}MB` : `${(total / 1024).toFixed(1)}GB`
              
              sendProgress('ollama', `⬇️  Downloading Ollama: ${realProgress}%`, totalProgress, realProgress, `${downloadedDisplay} / ${totalDisplay}`, true)
              stopProgressTimer()
            }
          }
        }
        
        // Pattern 3: Progress bars in stderr (as fallback)
        if (!progressDetected) {
          const progressBarMatch = output.match(/[█▓▒░\-=\|\\\/]{5,}\s*(\d+(?:\.\d+)?)%/)
          if (progressBarMatch) {
            const realProgress = Math.round(parseFloat(progressBarMatch[1]))
            if (realProgress >= 0 && realProgress <= 100 && Math.abs(realProgress - lastReportedProgress) >= 2) {
              ollamaProgress = realProgress
              lastReportedProgress = realProgress
              progressDetected = true
              
              console.log(`📊 Progress detected in stderr (progress bar): ${realProgress}%`)
              const totalProgress = Math.min(35 + (realProgress * 0.2), 55)
              sendProgress('ollama', `⬇️  Downloading Ollama: ${realProgress}%`, totalProgress, realProgress, '~150MB', true)
              stopProgressTimer()
            }
          }
        }
        
        // Pattern 4: Winget status messages to show activity
        if (!progressDetected) {
          const statusKeywords = ['downloading', 'installing', 'processing', 'extracting', 'configuring']
          const lowerOutput = output.toLowerCase()
          
          for (const keyword of statusKeywords) {
            if (lowerOutput.includes(keyword) && lowerOutput.length < 200) {
              // Show activity without specific progress
              const activityProgress = Math.min(lastReportedProgress + 1, 95)
              if (activityProgress > lastReportedProgress) {
                lastReportedProgress = activityProgress
                console.log(`📊 Activity detected: ${keyword} (${activityProgress}%)`)
                sendProgress('ollama', `⬇️  ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Ollama...`, 35 + (activityProgress * 0.2), activityProgress, '~150MB', true)
                progressDetected = true
              }
              break
            }
          }
        }
        
        // Error detection - be more careful about false positives
        const lowerOutput = output.toLowerCase()
        if (lowerOutput.includes('failed to install') || lowerOutput.includes('installation failed') || lowerOutput.includes('error code')) {
          console.error('❌ Critical installation error in stderr:', output.trim())
          stopProgressTimer()
          reject(new Error(`Installation failed: ${output.trim()}`))
        } else if (lowerOutput.includes('network') && lowerOutput.includes('error')) {
          console.warn('⚠️  Network issue detected, but continuing:', output.trim())
          // Don't fail on network warnings, let it retry
        }
      })
      
      winget.on('close', (code: number | null) => {
        stopProgressTimer()
        if (timeoutTimer) clearTimeout(timeoutTimer)
        ollamaInstallProcess = null // Clear the process reference
        
        console.log(`🔚 Ollama installation process closed with code: ${code}`)
        
        if (isOllamaInstallCancelled) {
          console.log('🛑 Installation was cancelled by user')
          reject(new Error('Installation cancelled by user'))
          return
        }
        
        if (code === 0) {
          console.log('✅ Ollama application installed successfully')
          sendProgress('ollama', '✅ Ollama application installed successfully', 55, 100, '~150MB')
          resolve()
        } else {
          console.error(`❌ Ollama installation failed with code ${code}`)
          reject(new Error(`Ollama installation failed with exit code ${code}`))
        }
      })
      
      winget.on('error', (err: any) => {
        stopProgressTimer()
        if (timeoutTimer) clearTimeout(timeoutTimer)
        console.error('❌ Ollama installation error:', err)
        reject(err)
      })
    })
    } catch (wingetError: any) {
      console.warn('⚠️  Winget installation failed, trying alternative method:', wingetError.message)
      sendProgress('ollama', '🔄 Winget failed, trying direct download...', 37, 0, '~150MB')
      
      // Fallback: Direct download and installation with progress tracking
      try {
        console.log('📥 Attempting direct download of Ollama installer with progress tracking...')
        
        // Enhanced PowerShell script with progress tracking
        const downloadScript = `
          $ProgressPreference = 'Continue'
          $ollamaUrl = "https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe"
          $installerPath = "$env:TEMP\\OllamaSetup.exe"
          
          Write-Host "STARTING_DOWNLOAD"
          
          try {
            # Use WebClient for progress tracking
            $webClient = New-Object System.Net.WebClient
            
            # Progress event handler
            $webClient.DownloadProgressChanged.Add({
              param($sender, $e)
              $percentComplete = $e.ProgressPercentage
              $bytesReceived = $e.BytesReceived / 1MB
              $totalBytes = $e.TotalBytesToReceive / 1MB
              Write-Host "DOWNLOAD_PROGRESS:$percentComplete:$($bytesReceived.ToString('F1')):$($totalBytes.ToString('F1'))"
            })
            
            # Download completed event
            $webClient.DownloadFileCompleted.Add({
              param($sender, $e)
              if ($e.Error) {
                Write-Host "DOWNLOAD_ERROR:$($e.Error.Message)"
              } else {
                Write-Host "DOWNLOAD_COMPLETE"
              }
            })
            
            # Start download
            $webClient.DownloadFileAsync($ollamaUrl, $installerPath)
            
            # Wait for download to complete
            while ($webClient.IsBusy) {
              Start-Sleep -Milliseconds 500
            }
            
            $webClient.Dispose()
            
            if (Test-Path $installerPath) {
              Write-Host "STARTING_INSTALL"
              $process = Start-Process -FilePath $installerPath -ArgumentList "/S" -PassThru -Wait
              if ($process.ExitCode -eq 0) {
                Write-Host "INSTALL_COMPLETE"
              } else {
                Write-Host "INSTALL_ERROR:Exit code $($process.ExitCode)"
              }
            } else {
              Write-Host "DOWNLOAD_ERROR:Installer file not found"
            }
          } catch {
            Write-Host "SCRIPT_ERROR:$($_.Exception.Message)"
          }
        `
        
        sendProgress('ollama', '⬇️  Starting direct download...', 40, 0, '~150MB')
        
        await new Promise<void>((resolve, reject) => {
          // Check for cancellation before starting
          if (isOllamaInstallCancelled) {
            reject(new Error('Installation cancelled by user'))
            return
          }
          
          const ps = spawn('powershell.exe', ['-Command', downloadScript], {
            windowsHide: true,
            stdio: 'pipe'
          })
          
          // Track the process for cancellation
          ollamaInstallProcess = ps
          
          let lastProgress = 0
          
          ps.stdout?.on('data', (data: Buffer) => {
            // Check for cancellation
            if (isOllamaInstallCancelled) {
              reject(new Error('Installation cancelled by user'))
              return
            }
            
            const output = data.toString().trim()
            console.log('📤 Direct download stdout:', output)
            
            // Parse structured progress messages
            if (output.startsWith('STARTING_DOWNLOAD')) {
              sendProgress('ollama', '⬇️  Connecting to download server...', 41, 5, '~150MB', true)
            } else if (output.startsWith('DOWNLOAD_PROGRESS:')) {
              const parts = output.split(':')
              if (parts.length >= 4) {
                const percent = parseInt(parts[1])
                const downloaded = parseFloat(parts[2])
                const total = parseFloat(parts[3])
                
                if (percent >= 0 && percent <= 100 && Math.abs(percent - lastProgress) >= 2) {
                  lastProgress = percent
                  const totalProgress = 41 + (percent * 0.12) // Map 0-100% to 41-53%
                  const downloadedDisplay = downloaded < 1024 ? `${downloaded.toFixed(1)}MB` : `${(downloaded / 1024).toFixed(1)}GB`
                  const totalDisplay = total < 1024 ? `${total.toFixed(1)}MB` : `${(total / 1024).toFixed(1)}GB`
                  
                  console.log(`📊 Direct download progress: ${percent}% (${downloaded.toFixed(1)}/${total.toFixed(1)} MB)`)
                  sendProgress('ollama', `⬇️  Downloading Ollama: ${percent}%`, totalProgress, percent, `${downloadedDisplay} / ${totalDisplay}`, true)
                }
              }
            } else if (output.startsWith('DOWNLOAD_COMPLETE')) {
              sendProgress('ollama', '✅ Download complete, preparing installation...', 53, 100, '~150MB')
            } else if (output.startsWith('STARTING_INSTALL')) {
              sendProgress('ollama', '⚙️  Installing Ollama application...', 54, 90, '~150MB')
            } else if (output.startsWith('INSTALL_COMPLETE')) {
              sendProgress('ollama', '✅ Ollama installed successfully', 55, 100, '~150MB')
            } else if (output.startsWith('DOWNLOAD_ERROR:') || output.startsWith('INSTALL_ERROR:') || output.startsWith('SCRIPT_ERROR:')) {
              const errorMsg = output.split(':').slice(1).join(':')
              console.error('❌ Direct download error:', errorMsg)
              reject(new Error(`Direct download failed: ${errorMsg}`))
              return
            }
          })
          
          ps.stderr?.on('data', (data: Buffer) => {
            const output = data.toString()
            console.log('⚠️  Direct download stderr:', output)
            // Don't fail on stderr as PowerShell may output progress info there
          })
          
          ps.on('close', (code: number | null) => {
            ollamaInstallProcess = null // Clear the process reference
            
            if (isOllamaInstallCancelled) {
              console.log('🛑 Direct download was cancelled by user')
              reject(new Error('Installation cancelled by user'))
              return
            }
            
            if (code === 0) {
              console.log('✅ Direct download installation completed successfully')
              resolve()
            } else {
              console.error(`❌ Direct download failed with code ${code}`)
              reject(new Error(`Direct download installation failed with exit code ${code}`))
            }
          })
          
          ps.on('error', (err: any) => {
            console.error('❌ Direct download process error:', err)
            reject(err)
          })
        })
        
        console.log('✅ Direct download method succeeded')
      } catch (fallbackError: any) {
        console.warn('⚠️  Direct download failed, trying Chocolatey as last resort:', fallbackError.message)
        sendProgress('ollama', '🔄 Direct download failed, trying Chocolatey...', 37, 0, '~150MB')
        
        // Try chocolatey as final fallback
        try {
          console.log('🍫 Attempting installation via chocolatey...')
          sendProgress('ollama', '🍫 Trying chocolatey installation...', 42, 0, '~150MB')
          
          await new Promise<void>((resolve, reject) => {
            const choco = spawn('choco', ['install', 'ollama', '-y'], {
              windowsHide: true,
              stdio: 'pipe'
            })
            
            choco.stdout?.on('data', (data: Buffer) => {
              const output = data.toString()
              console.log('📤 Chocolatey stdout:', output)
              
              if (output.includes('Installing') || output.includes('Downloading')) {
                sendProgress('ollama', '⬇️  Installing via chocolatey...', 45, 50, '~150MB')
              }
            })
            
            choco.on('close', (code: number | null) => {
              if (code === 0) {
                console.log('✅ Chocolatey installation successful')
                sendProgress('ollama', '✅ Ollama installed via chocolatey', 55, 100, '~150MB')
                resolve()
              } else {
                reject(new Error(`Chocolatey installation failed with code ${code}`))
              }
            })
            
            choco.on('error', reject)
          })
          
          console.log('✅ Chocolatey installation succeeded')
        } catch (chocoError: any) {
          console.error('❌ All installation methods failed')
          throw new Error(`All installation methods failed. Winget: ${wingetError.message}, Direct download: ${fallbackError.message}, Chocolatey: ${chocoError.message}`)
        }
      }
    }
    } // End if (!ollamaAlreadyInstalled)
    
    sendProgress('waiting', '⏳ Starting Ollama service...', 60, 0, undefined, false, '30-60 seconds', undefined)
    
    // Wait for Ollama to be ready with proper verification
    console.log('🔍 Verifying Ollama service is running...')
    let ollamaReady = false
    let attempts = 0
    const maxAttempts = 10
    
    while (!ollamaReady && attempts < maxAttempts) {
      try {
        attempts++
        console.log(`📋 Ollama service check attempt ${attempts}/${maxAttempts}...`)
        
        // Try to check if Ollama is responding
        const { stdout } = await execAsync('ollama list', { timeout: 10000 })
        console.log('✅ Ollama service is responding:', stdout.substring(0, 100))
        ollamaReady = true
        sendProgress('waiting', '✅ Ollama service confirmed running', 65, 100, undefined, false, 'Complete', undefined)
        
      } catch (error) {
        console.log(`⚠️  Ollama service not ready yet (attempt ${attempts}):`, error)
        if (attempts < maxAttempts) {
          console.log('⏳ Waiting 3 seconds before retry...')
          await new Promise(resolve => setTimeout(resolve, 3000))
          sendProgress('waiting', `⏳ Waiting for Ollama service... (${attempts}/${maxAttempts})`, 60 + (attempts * 5), (attempts / maxAttempts) * 100, undefined, false, `${(maxAttempts - attempts) * 3}s`, undefined)
        }
      }
    }
    
    if (!ollamaReady) {
      throw new Error('Ollama service failed to start after multiple attempts')
    }
    
    sendProgress('model', '🧠 Downloading qwen3:8b model...', 70, 0, '~4.5GB', true, '10-15 minutes', undefined)
    
    // Pull the qwen3:8b model with robust error handling and timeout
    await new Promise<void>((resolve, reject) => {
      // Check for cancellation before starting model download
      if (isOllamaInstallCancelled) {
        reject(new Error('Installation cancelled by user'))
        return
      }
      
      console.log('🚀 Starting qwen3:8b model download...')
      
      const ollama = spawn('ollama', ['pull', 'qwen3:8b'], {
        windowsHide: true,
        stdio: 'pipe',
        detached: false, // Ensure process is not detached so we can kill it properly
        killSignal: 'SIGKILL' // Use SIGKILL by default
      })
      
      // Track the process for cancellation
      ollamaInstallProcess = ollama
      
      let lastProgress = 70
      let lastModelProgress = -1 // Initialize to -1 to ensure first update
      let lastOutputTime = Date.now()
      let downloadStarted = false
      let modelDownloadStartTime = Date.now()
      let lastModelSize = 0
      let lastModelSizeTime = Date.now()
      
      // Set up a comprehensive timeout system
      const setupTimeouts = () => {
        // Overall timeout (15 minutes for model download)
        const overallTimeout = setTimeout(() => {
          console.error('❌ Model download timeout - process exceeded 15 minutes')
          try {
            ollama.kill('SIGKILL')
          } catch (err) {
            console.error('Error killing ollama process:', err)
          }
          reject(new Error('Model download timed out after 15 minutes'))
        }, 15 * 60 * 1000) // 15 minutes
        
        // Inactivity timeout (5 minutes without output)
        let inactivityTimeout: NodeJS.Timeout
        
        const resetInactivityTimeout = () => {
          if (inactivityTimeout) clearTimeout(inactivityTimeout)
          inactivityTimeout = setTimeout(() => {
            console.error('❌ Model download appears stuck - no output for 5 minutes')
            try {
              ollama.kill('SIGKILL')
            } catch (err) {
              console.error('Error killing stuck ollama process:', err)
            }
            reject(new Error('Model download appears to be stuck (no progress for 5 minutes)'))
          }, 5 * 60 * 1000) // 5 minutes
        }
        
        resetInactivityTimeout() // Start initial timeout
        
        return { overallTimeout, resetInactivityTimeout }
      }
      
      const { overallTimeout, resetInactivityTimeout } = setupTimeouts()
      
      // Enhanced progress tracking
      const updateProgress = (progress: number, source: string, details?: string) => {
        if (progress !== lastModelProgress && progress >= 0 && progress <= 100) {
          lastModelProgress = progress
          lastOutputTime = Date.now()
          resetInactivityTimeout() // Reset timeout on any progress
          
          // Calculate download speed and time estimates for model
          const currentTime = Date.now()
          const totalBytes = 4.5 * 1024 * 1024 * 1024 // 4.5GB in bytes
          const downloadedBytes = (progress / 100) * totalBytes
          const downloadedGB = downloadedBytes / (1024 * 1024 * 1024)
          
          let downloadSpeed = ''
          let timeEstimate = ''
          
          if (downloadStarted && currentTime > modelDownloadStartTime + 3000) { // After 3 seconds of actual downloading
            const elapsedSeconds = (currentTime - modelDownloadStartTime) / 1000
            const bytesPerSecond = downloadedBytes / elapsedSeconds
            const mbPerSecond = bytesPerSecond / (1024 * 1024)
            
            if (mbPerSecond > 1) {
              downloadSpeed = `${mbPerSecond.toFixed(1)} MB/s`
            } else {
              downloadSpeed = `${(mbPerSecond * 1024).toFixed(0)} KB/s`
            }
            
            // Estimate remaining time
            const remainingBytes = totalBytes - downloadedBytes
            const remainingSeconds = remainingBytes / bytesPerSecond
            if (remainingSeconds < 60) {
              timeEstimate = `${Math.round(remainingSeconds)}s`
            } else if (remainingSeconds < 3600) {
              timeEstimate = `${Math.round(remainingSeconds / 60)}m ${Math.round(remainingSeconds % 60)}s`
            } else {
              timeEstimate = `${Math.round(remainingSeconds / 3600)}h ${Math.round((remainingSeconds % 3600) / 60)}m`
            }
          } else if (!downloadStarted && progress > 0) {
            timeEstimate = '10-15 minutes'
          }
          
          const totalProgress = Math.min(70 + (progress * 0.28), 98)
          const downloadedGBDisplay = downloadedGB.toFixed(1)
          
          console.log(`📊 Model download progress (${source}): ${progress}% (Total: ${totalProgress}%)${details ? ' - ' + details : ''}${downloadSpeed ? ' - ' + downloadSpeed : ''}`)
          sendProgress('model', `⬇️  Downloading qwen3:8b model: ${progress}%`, totalProgress, progress, `${downloadedGBDisplay}GB / 4.5GB`, true, timeEstimate, downloadSpeed)
          
          if (!downloadStarted && progress > 0) {
            downloadStarted = true
            modelDownloadStartTime = Date.now()
            console.log('🌐 Model download confirmed started')
          }
        }
      }
      
      ollama.stdout?.on('data', (data: Buffer) => {
        // Check for cancellation
        if (isOllamaInstallCancelled) {
          reject(new Error('Installation cancelled by user'))
          return
        }
        
        const output = data.toString()
        console.log('Ollama pull output:', output)
        
        // Parse download progress with multiple patterns - SIMPLIFIED AND MORE RESPONSIVE
        // Look for percentage patterns first (most common)
        const percentMatch = output.match(/(\d+(?:\.\d+)?)%/)
        if (percentMatch) {
          const downloadProgress = Math.round(parseFloat(percentMatch[1]))
          
          // Update immediately if ANY progress change (no throttling)
          if (downloadProgress !== lastModelProgress && downloadProgress >= 0 && downloadProgress <= 100) {
            lastModelProgress = downloadProgress
            const totalProgress = Math.min(70 + (downloadProgress * 0.28), 98) // 70% + 28% for download, cap at 98%
            
            // Calculate download size
            const downloadedGB = ((downloadProgress / 100) * 4.5).toFixed(1)
            
            console.log(`📊 Model download progress: ${downloadProgress}% (Total: ${totalProgress}%)`)
            sendProgress('model', `⬇️  Downloading qwen3:8b model: ${downloadProgress}%`, totalProgress, downloadProgress, `${downloadedGB}GB / 4.5GB`)
          }
        }
        // Look for fraction progress like "2.1 GB / 4.5 GB"
        else if (output.includes('GB')) {
          const gbMatch = output.match(/(\d+(?:\.\d+)?)\s*GB\s*\/\s*(\d+(?:\.\d+)?)\s*GB/)
          if (gbMatch) {
            const downloaded = parseFloat(gbMatch[1])
            const total = parseFloat(gbMatch[2])
            const downloadProgress = Math.round((downloaded / total) * 100)
            
            if (downloadProgress !== lastModelProgress && downloadProgress >= 0 && downloadProgress <= 100) {
              lastModelProgress = downloadProgress
              const totalProgress = Math.min(70 + (downloadProgress * 0.28), 98)
              
              console.log(`📊 Model download progress (GB): ${downloaded}GB/${total}GB = ${downloadProgress}%`)
              sendProgress('model', `⬇️  Downloading qwen3:8b model: ${downloadProgress}%`, totalProgress, downloadProgress, `${downloaded.toFixed(1)}GB / ${total.toFixed(1)}GB`)
            }
          }
        }
        // Look for MB progress as fallback
        else if (output.includes('MB')) {
          const mbMatch = output.match(/(\d+(?:\.\d+)?)\s*MB\s*\/\s*(\d+(?:\.\d+)?)\s*MB/)
          if (mbMatch) {
            const downloaded = parseFloat(mbMatch[1])
            const total = parseFloat(mbMatch[2])
            const downloadProgress = Math.round((downloaded / total) * 100)
            
            if (downloadProgress !== lastModelProgress && downloadProgress >= 0 && downloadProgress <= 100) {
              lastModelProgress = downloadProgress
              const totalProgress = Math.min(70 + (downloadProgress * 0.28), 98)
              
              const downloadedGB = (downloaded / 1024).toFixed(1)
              const totalGB = (total / 1024).toFixed(1)
              
              console.log(`📊 Model download progress (MB): ${downloaded}MB/${total}MB = ${downloadProgress}%`)
              sendProgress('model', `⬇️  Downloading qwen3:8b model: ${downloadProgress}%`, totalProgress, downloadProgress, `${downloadedGB}GB / ${totalGB}GB`)
            }
          }
        }
        
        // Look for other progress indicators
        if (output.includes('pulling manifest')) {
          if (lastModelProgress < 5) {
            lastModelProgress = 5
            sendProgress('model', '📋 Fetching model manifest...', 72, 5, '~4.5GB')
          }
        } else if (output.includes('pulling') && output.includes('complete')) {
          if (lastModelProgress < 95) {
            lastModelProgress = 95
            sendProgress('model', '✅ Download complete, verifying model...', 94, 95, '4.5GB / 4.5GB')
          }
        } else if (output.includes('verifying sha256')) {
          if (lastModelProgress < 98) {
            lastModelProgress = 98
            sendProgress('model', '🔐 Verifying model integrity...', 96, 98, '4.5GB')
          }
        } else if (output.includes('writing manifest')) {
          if (lastModelProgress < 99) {
            lastModelProgress = 99
            sendProgress('model', '📝 Finalizing model installation...', 98, 99, '4.5GB')
          }
        }
      })
      
      // Handle stderr with comprehensive progress parsing
      ollama.stderr?.on('data', (data: Buffer) => {
        // Check for cancellation
        if (isOllamaInstallCancelled) {
          reject(new Error('Installation cancelled by user'))
          return
        }
        
        const text = data.toString()
        lastOutputTime = Date.now()
        resetInactivityTimeout() // Reset timeout on any output
        
        console.log('🔍 Model stderr output:', text.trim())
        
        // Parse various progress patterns
        const progressPatterns = [
          // Primary pattern: "pulling manifest... 25%" or "downloading... 50%"
          /(?:pulling|downloading|verifying).*?(\d+(?:\.\d+)?)%/i,
          // Secondary pattern: "25% complete" or "50% done"
          /(\d+(?:\.\d+)?)%\s*(?:complete|done|downloaded)/i,
          // Tertiary pattern: "[25%]" or "(50%)"
          /[\[\(](\d+(?:\.\d+)?)%[\]\)]/,
          // Progress bars: "████████░░ 80%"
          /[█▓▒░\-=\|\\\/]{4,}\s*(\d+(?:\.\d+)?)%/,
          // Simple percentage
          /(\d+(?:\.\d+)?)%/
        ]
        
        for (const pattern of progressPatterns) {
          const match = text.match(pattern)
          if (match) {
            const progress = Math.round(parseFloat(match[1]))
            updateProgress(progress, 'stderr', text.trim())
            break
          }
        }
        
        // Look for GB patterns in stderr
        const gbMatch = text.match(/(\d+(?:\.\d+)?)\s*GB\s*\/\s*(\d+(?:\.\d+)?)\s*GB/)
        if (gbMatch) {
          const downloaded = parseFloat(gbMatch[1])
          const total = parseFloat(gbMatch[2])
          const progress = Math.round((downloaded / total) * 100)
          updateProgress(progress, 'stderr-GB', `${downloaded.toFixed(1)}GB/${total.toFixed(1)}GB`)
        }
        
        // Check for completion indicators
        if (text.includes('success') || text.includes('completed') || text.includes('done')) {
          console.log('✅ Model download completion detected in stderr')
        }
        
        // Check for error indicators
        if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
          console.error('❌ Error detected in model download stderr:', text.trim())
        }
      })
      
      // Handle stdout with progress parsing
      ollama.stdout?.on('data', (data: Buffer) => {
        // Check for cancellation
        if (isOllamaInstallCancelled) {
          reject(new Error('Installation cancelled by user'))
          return
        }
        
        const text = data.toString()
        lastOutputTime = Date.now()
        resetInactivityTimeout() // Reset timeout on any output
        
        console.log('� Model stdout output:', text.trim())
        
        // Parse progress from stdout (similar patterns)
        const progressPatterns = [
          /(?:pulling|downloading|verifying).*?(\d+(?:\.\d+)?)%/i,
          /(\d+(?:\.\d+)?)%\s*(?:complete|done|downloaded)/i,
          /[\[\(](\d+(?:\.\d+)?)%[\]\)]/,
          /[█▓▒░\-=\|\\\/]{4,}\s*(\d+(?:\.\d+)?)%/,
          /(\d+(?:\.\d+)?)%/
        ]
        
        for (const pattern of progressPatterns) {
          const match = text.match(pattern)
          if (match) {
            const progress = Math.round(parseFloat(match[1]))
            updateProgress(progress, 'stdout', text.trim())
            break
          }
        }
        
        // Check for completion
        if (text.includes('success') || text.includes('completed')) {
          console.log('✅ Model download completion detected in stdout')
        }
      })
      
      // Handle process completion
      ollama.on('close', (code: number | null) => {
        if (overallTimeout) clearTimeout(overallTimeout)
        ollamaInstallProcess = null // Clear the process reference
        
        console.log(`🔚 Model download process closed with code: ${code}`)
        
        if (isOllamaInstallCancelled) {
          console.log('🛑 Model download was cancelled by user')
          reject(new Error('Installation cancelled by user'))
          return
        }
        
        if (code === 0) {
          console.log('✅ Model download completed successfully!')
          sendProgress('model', '🎉 Model download completed successfully!', 98, 100, '4.5GB', false, 'Complete', undefined)
          resolve()
        } else {
          console.error(`❌ Model download failed with exit code ${code}`)
          reject(new Error(`Model download failed with exit code ${code}`))
        }
      })
      
      // Handle process errors
      ollama.on('error', (err: any) => {
        if (overallTimeout) clearTimeout(overallTimeout)
        console.error('❌ Model download process error:', err)
        reject(new Error(`Model download process error: ${err.message}`))
      })
      
      // Monitor for stuck process (no output for extended period)
      const monitorInterval = setInterval(() => {
        const timeSinceLastOutput = Date.now() - lastOutputTime
        
        if (timeSinceLastOutput > 3 * 60 * 1000) { // 3 minutes
          console.warn(`⚠️ No output for ${Math.round(timeSinceLastOutput / 1000)} seconds`)
          
          if (timeSinceLastOutput > 5 * 60 * 1000 && !downloadStarted) { // 5 minutes without starting
            console.error('❌ Download appears to have never started')
            clearInterval(monitorInterval)
            try {
              ollama.kill('SIGKILL')
            } catch (err) {
              console.error('Error killing stuck ollama process:', err)
            }
            reject(new Error('Model download failed to start within 5 minutes'))
          }
        }
      }, 30 * 1000) // Check every 30 seconds
      
      // Clear monitoring when process ends
      ollama.on('close', () => {
        clearInterval(monitorInterval)
      })
    })
    
    sendProgress('starting', '🚀 Starting qwen3:8b model...', 95, 0, undefined, false, '10-20 seconds', undefined)
    
    // Start the model in background
    const runModel = spawn('ollama', ['run', 'qwen3:8b'], {
      windowsHide: true,
      detached: true,
      stdio: 'ignore'
    })
    
    runModel.unref() // Allow the process to run independently
    
    // Give the model a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    sendProgress('complete', '🎉 Ollama setup completed successfully!', 100, 100, 'Ready', false, 'Complete', undefined)
    
    return {
      success: true,
      message: 'Ollama and qwen3:8b model installed successfully'
    }
    
  } catch (error: any) {
    console.error('Error installing Ollama:', error)
    
    // Clear process reference
    ollamaInstallProcess = null
    
    // Check if it was a user cancellation
    if (isOllamaInstallCancelled || error.message === 'Installation cancelled by user') {
      console.log('🛑 Installation cancelled by user')
      event.sender.send('ollama-install-progress', { 
        step: 'cancelled', 
        message: '🛑 Installation cancelled by user', 
        progress: 0,
        cancelled: true,
        timestamp: Date.now()
      })
      
      // Also send global download cancellation
      event.sender.send('global-download-progress', {
        id: 'ollama-setup',
        title: 'Ollama Setup',
        description: '🛑 Installation cancelled by user',
        progress: 0,
        status: 'cancelled',
        cancellable: false
      })
      
      return {
        success: false,
        cancelled: true,
        error: 'Installation cancelled by user'
      }
    }
    
    event.sender.send('ollama-install-progress', { 
      step: 'error', 
      message: `❌ Installation failed: ${error.message}`, 
      progress: 0,
      error: true,
      timestamp: Date.now()
    })
    
    // Also send global download error
    event.sender.send('global-download-progress', {
      id: 'ollama-setup',
      title: 'Ollama Setup',
      description: `❌ Installation failed: ${error.message}`,
      progress: 0,
      status: 'error',
      error: error.message,
      cancellable: false
    })
    
    return {
      success: false,
      error: error.message
    }
  } finally {
    // Reset cancellation flag and clear process reference
    isOllamaInstallCancelled = false
    ollamaInstallProcess = null
  }
})

ipcMain.handle('cancel-ollama-installation', async () => {
  try {
    console.log('🛑 Cancelling Ollama installation process...')
    isOllamaInstallCancelled = true
    
    // Kill the tracked process first
    if (ollamaInstallProcess) {
      console.log('🔪 Terminating tracked installation process...')
      await forceTerminateProcess(ollamaInstallProcess, 'Ollama installation')
      ollamaInstallProcess = null
    }
    
    // Clean up any remaining Ollama processes
    console.log('🧹 Cleaning up remaining Ollama processes...')
    await killLingOllamaProcesses()
    
    console.log('✅ Ollama installation cancelled successfully')
    return {
      success: true,
      message: 'Installation cancelled successfully'
    }
  } catch (error: any) {
    console.error('Error cancelling Ollama installation:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

ipcMain.handle('start-ollama-model', async () => {
  try {
    const { spawn } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(require('child_process').exec)
    
    console.log('Starting ollama model...')
    
    // First check if the model is already running
    try {
      const { stdout: psOutput } = await execAsync('ollama ps', { timeout: 5000 })
      console.log('Current running models:', psOutput)
      if (psOutput.includes('qwen3:8b')) {
        console.log('Model is already running')
        return {
          success: true,
          message: 'qwen3:8b model is already running'
        }
      }
    } catch (error) {
      console.log('Error checking running models, will attempt to start:', error)
    }
    
    // Pre-load the model silently using a simple API call approach
    console.log('Pre-loading qwen3:8b model silently...')
    
    try {
      // Use a simple HTTP request to the Ollama API to load the model
      // This approach doesn't open any GUI windows
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen3:8b',
          prompt: 'Hello',
          stream: false,
          options: {
            num_predict: 1 // Only generate 1 token to minimize processing
          }
        })
      })
      
      if (response.ok) {
        console.log('Model loaded successfully via API')
        return {
          success: true,
          message: 'qwen3:8b model loaded successfully'
        }
      } else {
        throw new Error(`API request failed with status ${response.status}`)
      }
    } catch (apiError) {
      console.log('API approach failed, trying alternative method:', apiError)
      
      // Fallback: Use ollama show command to load model metadata (this loads the model)
      try {
        console.log('Using ollama show to load model...')
        await execAsync('ollama show qwen3:8b', { timeout: 10000 })
        
        // Verify the model is now loaded
        const { stdout: psOutput } = await execAsync('ollama ps', { timeout: 5000 })
        console.log('Post-show ollama ps output:', psOutput)
        
        if (psOutput.includes('qwen3:8b')) {
          console.log('Model loaded successfully via show command')
          return {
            success: true,
            message: 'qwen3:8b model loaded successfully'
          }
        }
      } catch (showError) {
        console.log('Show command failed:', showError)
      }
    }
    
    // Final verification
    try {
      const { stdout: finalCheck } = await execAsync('ollama list', { timeout: 5000 })
      console.log('Final verification - ollama list output:', finalCheck)
      if (finalCheck.includes('qwen3:8b')) {
        console.log('Model verified as available')
        return {
          success: true,
          message: 'qwen3:8b model is available and ready'
        }
      }
    } catch (error) {
      console.log('Final verification failed:', error)
    }
    
    return {
      success: false,
      error: 'Failed to load qwen3:8b model'
    }
    
  } catch (error: any) {
    console.error('Error starting Ollama model:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

ipcMain.handle('stop-ollama', async () => {
  try {
    await stopOllamaProcess()
    return {
      success: true,
      message: 'Ollama processes stopped successfully'
    }
  } catch (error: any) {
    console.error('Error stopping Ollama:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

// App event handlers
app.whenReady().then(() => {
  createWindow()
  
  // Start API process immediately since user setup is now handled by the API
  console.log('App ready, starting API process...')
  startApiProcess()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', async () => {
  console.log('All windows closed, stopping processes...')
  await stopApiProcess()
  await stopOllamaProcess()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  console.log('App is quitting, stopping processes...')
  await stopApiProcess()
  await stopOllamaProcess()
})

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

// Window control handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false
})

ipcMain.handle('check-api-health', async () => {
  try {
    // Use HTTP instead of HTTPS to avoid certificate issues
    const response = await fetch('http://localhost:5000/api/health')
    // Consider any response (even errors) as the API being up
    // since it means the API process is running and responding
    if (response.status === 200) {
      try {
        return await response.json()
      } catch {
        // If JSON parsing fails, return a success indicator
        return { status: 'ok', message: 'API is responding' }
      }
    } else if (response.status >= 400 && response.status < 600) {
      // API is responding with an error, but it's still up
      return { status: 'error', message: `API responding with status ${response.status}`, httpStatus: response.status }
    }
    throw new Error('API not responding')
  } catch (error) {
    console.error('API health check failed:', error)
    return null
  }
})

// Groq API Key management (Legacy - API keys are now primarily managed by backend user system)
ipcMain.handle('save-groq-api-key', async (event, apiKey: string) => {
  try {
    // Note: This is a legacy method. API keys are now primarily managed by the backend user system.
    // This handler is kept for backward compatibility and fallback scenarios.
    
    let apiDir: string
    
    if (app.isPackaged) {
      apiDir = path.join(process.resourcesPath, 'api_publish')
    } else {
      apiDir = path.join(__dirname, '../api_publish')
    }
    
    const appsettingsPath = path.join(apiDir, 'appsettings.json')
    
    // Read current appsettings.json
    let appsettings: any = {}
    if (fs.existsSync(appsettingsPath)) {
      const content = fs.readFileSync(appsettingsPath, 'utf8')
      appsettings = JSON.parse(content)
    }
    
    // Update the Groq API key
    if (!appsettings.Groq) {
      appsettings.Groq = {}
    }
    appsettings.Groq.ApiKey = apiKey
    
    // Write back to file
    fs.writeFileSync(appsettingsPath, JSON.stringify(appsettings, null, 2), 'utf8')
    
    console.log('Groq API key saved to appsettings.json (legacy method)')
    return { success: true, message: 'API key saved successfully' }
  } catch (error) {
    console.error('Error saving Groq API key:', error)
    return { success: false, message: `Failed to save API key: ${error}` }
  }
})

ipcMain.handle('get-groq-api-key-status', async () => {
  try {
    let apiDir: string
    
    if (app.isPackaged) {
      apiDir = path.join(process.resourcesPath, 'api_publish')
    } else {
      apiDir = path.join(__dirname, '../api_publish')
    }
    
    const appsettingsPath = path.join(apiDir, 'appsettings.json')
    
    if (!fs.existsSync(appsettingsPath)) {
      return { hasApiKey: false }
    }
    
    const content = fs.readFileSync(appsettingsPath, 'utf8')
    const appsettings = JSON.parse(content)
    
    const apiKey = appsettings?.Groq?.ApiKey || ''
    
    if (apiKey && apiKey.trim()) {
      return { 
        hasApiKey: true, 
        keyPrefix: apiKey.substring(0, 8) + '...' 
      }
    } else {
      return { hasApiKey: false }
    }
  } catch (error) {
    console.error('Error checking Groq API key status:', error)
    return { hasApiKey: false }
  }
})

// API Process management
ipcMain.handle('start-api-process', async (event, setupType: 'groq' | 'local' | 'basic') => {
  try {
    // Stop any existing API process first
    if (apiProcess) {
      console.log('Stopping existing API process before starting new one...')
      await stopApiProcess()
      // Add a longer delay to ensure the port is fully freed and all resources are cleaned up
      console.log('Waiting for port to be freed...')
      await new Promise(resolve => setTimeout(resolve, 3000))
    }

    console.log(`Starting API process for setup type: ${setupType}`)
    
    // Note: API key management is now handled by the backend user management system
    // No need to modify appsettings.json here
    
    startApiProcess()
    
    return { success: true, message: 'API process started successfully' }
  } catch (error) {
    console.error('Error starting API process:', error)
    return { success: false, message: `Failed to start API process: ${error}` }
  }
})

ipcMain.handle('stop-api-process', async () => {
  try {
    await stopApiProcess()
    return { success: true, message: 'API process stopped successfully' }
  } catch (error) {
    console.error('Error stopping API process:', error)
    return { success: false, message: `Failed to stop API process: ${error}` }
  }
})

ipcMain.handle('get-api-process-status', async () => {
  return {
    isRunning: apiProcess !== null && !apiProcess.killed,
    pid: apiProcess?.pid || null
  }
})

// Menu setup
if (isDev()) {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Dev',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    }
  ]))
}
