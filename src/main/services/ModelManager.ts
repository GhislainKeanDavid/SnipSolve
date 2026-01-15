import fs from 'fs/promises'
import { existsSync, createWriteStream, statSync } from 'fs'
import path from 'path'
import os from 'os'
import fetch from 'node-fetch'
import { EventEmitter } from 'events'

export interface DownloadProgress {
  downloaded: number
  total: number
  percentage: number
  mbDownloaded: string
  mbTotal: string
}

// Expected model size in bytes (~2.4GB)
const EXPECTED_MODEL_SIZE = 2393232608

export class ModelManager extends EventEmitter {
  private modelDir: string
  private modelPath: string
  private modelUrl: string
  private modelName: string

  constructor() {
    super()
    const dataDir = path.join(os.homedir(), '.snipsolve')
    this.modelDir = path.join(dataDir, 'models')
    this.modelName = 'Phi-3-mini-4k-instruct-q4.gguf'
    this.modelPath = path.join(this.modelDir, this.modelName)

    // Phi-3-mini-4k-instruct Q4_K_M quantized model (~2.4GB)
    this.modelUrl = 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf'
  }

  /**
   * Check if the model file exists locally and is complete (not corrupted)
   */
  async isModelAvailable(): Promise<boolean> {
    if (!existsSync(this.modelPath)) {
      return false
    }

    // Check file size to detect incomplete downloads
    try {
      const stats = statSync(this.modelPath)
      const minExpectedSize = EXPECTED_MODEL_SIZE * 0.95 // Allow 5% variance

      if (stats.size < minExpectedSize) {
        console.log(`⚠️ Model file appears incomplete: ${(stats.size / 1024 / 1024).toFixed(2)}MB (expected ~${(EXPECTED_MODEL_SIZE / 1024 / 1024).toFixed(2)}MB)`)
        // Delete the incomplete file
        await fs.unlink(this.modelPath)
        console.log('🗑️ Deleted incomplete model file')
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking model file:', error)
      return false
    }
  }

  /**
   * Get the path to the model file
   */
  getModelPath(): string {
    return this.modelPath
  }

  /**
   * Download the model file with progress tracking
   * Uses manual redirect following and chunk-by-chunk writing for reliability
   */
  async downloadModel(): Promise<void> {
    console.log(`📥 Starting model download from ${this.modelUrl}`)

    // Ensure models directory exists
    await fs.mkdir(this.modelDir, { recursive: true })

    try {
      // Follow redirects manually to get the final URL
      let finalUrl = this.modelUrl
      let response = await fetch(finalUrl, { redirect: 'follow' })

      if (!response.ok) {
        throw new Error(`Failed to download model: ${response.status} ${response.statusText}`)
      }

      // Get content length - use expected size as fallback
      let totalSize = parseInt(response.headers.get('content-length') || '0', 10)
      if (totalSize === 0) {
        console.log('⚠️ Content-Length not provided, using expected size for progress')
        totalSize = EXPECTED_MODEL_SIZE
      }

      console.log(`📥 Downloading ${(totalSize / 1024 / 1024).toFixed(2)}MB...`)

      // Write chunks using createWriteStream for proper handling of large files
      const fileStream = createWriteStream(this.modelPath)
      let bytesWritten = 0
      let lastLoggedPercent = -5

      return new Promise<void>((resolve, reject) => {
        const writeChunk = async () => {
          try {
            for await (const chunk of response.body as AsyncIterable<Buffer>) {
              // Write chunk and wait for drain if needed
              const canContinue = fileStream.write(chunk)
              bytesWritten += chunk.length

              const percentage = (bytesWritten / totalSize) * 100

              const progress: DownloadProgress = {
                downloaded: bytesWritten,
                total: totalSize,
                percentage: Math.round(percentage * 100) / 100,
                mbDownloaded: (bytesWritten / 1024 / 1024).toFixed(2),
                mbTotal: (totalSize / 1024 / 1024).toFixed(2)
              }

              // Emit progress event
              this.emit('download-progress', progress)

              // Log progress every 5%
              if (Math.floor(percentage) >= lastLoggedPercent + 5) {
                lastLoggedPercent = Math.floor(percentage)
                console.log(`📥 Download progress: ${progress.percentage}% (${progress.mbDownloaded}MB / ${progress.mbTotal}MB)`)
              }

              // Handle backpressure
              if (!canContinue) {
                await new Promise<void>(r => fileStream.once('drain', r))
              }
            }

            // End the stream and wait for it to finish
            fileStream.end()
          } catch (err) {
            fileStream.destroy()
            reject(err)
          }
        }

        fileStream.on('finish', () => {
          // Verify downloaded file size
          const stats = statSync(this.modelPath)
          const minExpectedSize = EXPECTED_MODEL_SIZE * 0.95

          console.log(`📦 File size: ${(stats.size / 1024 / 1024).toFixed(2)}MB, bytes written: ${(bytesWritten / 1024 / 1024).toFixed(2)}MB`)

          if (stats.size < minExpectedSize) {
            const error = new Error(`Download incomplete: ${(stats.size / 1024 / 1024).toFixed(2)}MB received, expected ~${(EXPECTED_MODEL_SIZE / 1024 / 1024).toFixed(2)}MB`)
            fs.unlink(this.modelPath).catch(() => {})
            this.emit('download-error', error)
            reject(error)
            return
          }

          console.log('✅ Model downloaded successfully')
          this.emit('download-complete')
          resolve()
        })

        fileStream.on('error', (err) => {
          fs.unlink(this.modelPath).catch(() => {})
          this.emit('download-error', err)
          reject(err)
        })

        writeChunk()
      })

    } catch (error) {
      this.emit('download-error', error)
      throw error
    }
  }

  /**
   * Ensure the model is available (download if necessary)
   */
  async ensureModel(): Promise<string> {
    const isAvailable = await this.isModelAvailable()

    if (!isAvailable) {
      console.log('⚠️ Model not found locally. Starting download...')
      await this.downloadModel()
    } else {
      console.log('✅ Model found locally')
    }

    return this.modelPath
  }

  /**
   * Delete the model file (for testing or re-downloading)
   */
  async deleteModel(): Promise<void> {
    if (existsSync(this.modelPath)) {
      await fs.unlink(this.modelPath)
      console.log('🗑️ Model deleted')
    }
  }
}
