import { ModelManager } from './ModelManager'

// Dynamic import types for node-llama-cpp
type LlamaModel = any
type LlamaContext = any
type LlamaChatSession = any

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

export class AIService {
  private modelManager: ModelManager
  private model: LlamaModel | null = null
  private context: LlamaContext | null = null
  private initialized: boolean = false

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager
  }

  /**
   * Initialize the AI service (download model if needed, load it into memory)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('✅ AI Service already initialized')
      return
    }

    try {
      console.log('🧠 Initializing AI Service...')

      // Ensure model is downloaded
      const modelPath = await this.modelManager.ensureModel()

      // Dynamically import node-llama-cpp (ESM module)
      const { getLlama } = await import('node-llama-cpp')

      // Get llama instance
      const llama = await getLlama()

      // Load the model
      console.log('📦 Loading model into memory...')
      this.model = await llama.loadModel({
        modelPath: modelPath
      })

      // Create context (working memory for the model)
      this.context = await this.model.createContext({
        contextSize: 4096 // Phi-3 supports 4k context
      })

      this.initialized = true
      console.log('✅ AI Service initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize AI Service:', error)
      throw error
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Generate a chat completion (mimics OpenAI's interface)
   */
  async createChatCompletion(
    messages: ChatMessage[],
    options?: {
      maxTokens?: number
      temperature?: number
    }
  ): Promise<ChatCompletionResponse> {
    if (!this.initialized || !this.model || !this.context) {
      throw new Error('AI Service not initialized. Call initialize() first.')
    }

    let contextSequence = null

    try {
      // Dynamically import LlamaChatSession
      const { LlamaChatSession } = await import('node-llama-cpp')

      // Create a new sequence for this completion
      contextSequence = this.context.getSequence()

      // Create a new session for this completion
      const session = new LlamaChatSession({
        contextSequence: contextSequence
      })

      // Build the prompt from messages
      let prompt = ''
      for (const message of messages) {
        if (message.role === 'system') {
          prompt += `System: ${message.content}\n\n`
        } else if (message.role === 'user') {
          prompt += `User: ${message.content}\n\n`
        } else if (message.role === 'assistant') {
          prompt += `Assistant: ${message.content}\n\n`
        }
      }
      prompt += 'Assistant: '

      // Generate response
      const response = await session.prompt(prompt, {
        maxTokens: options?.maxTokens || 500,
        temperature: options?.temperature ?? 0.2
      })

      // Dispose of the sequence after use to free resources
      contextSequence.dispose()
      contextSequence = null

      return {
        choices: [
          {
            message: {
              content: typeof response === 'string' ? response.trim() : ''
            }
          }
        ]
      }
    } catch (error) {
      // Clean up sequence on error
      if (contextSequence) {
        try {
          contextSequence.dispose()
        } catch (_) {
          // Ignore disposal errors
        }
      }
      console.error('❌ Chat completion error:', error)
      throw error
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.context) {
      this.context.dispose()
      this.context = null
    }
    if (this.model) {
      this.model.dispose()
      this.model = null
    }
    this.initialized = false
    console.log('🧹 AI Service disposed')
  }
}
