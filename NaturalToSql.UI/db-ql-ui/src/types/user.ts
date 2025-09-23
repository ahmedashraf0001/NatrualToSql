// User profile management types
export enum AIMode {
  Groq = 'Groq',
  Local = 'Local',
  Basic = 'Basic'
}

export interface CreateUserInfoRequest {
  apiKey: string
  mode: AIMode
}

export interface UserInfoResponse {
  id: string
  success: boolean
  message?: string
}

export interface GetUserByIdRequest {
  id: string
}

export interface ProfileDto {
  id: string
  name: string
  databaseName: string
  createdUtc: string
  provider: string // ProviderType enum as string
  secretRef?: string
  cacheFile?: string
}

export interface UserInfoDto {
  id: string
  apiKey: string
  mode: AIMode
  createdUtc: string
  lastUpdatedUtc: string
  profiles: ProfileDto[]
}

export interface UpdateAiModeRequest {
  userId: string
  apiKey?: string
  newAiMode: AIMode
}

export enum ConnectionType {
  AutoConnect = 'AutoConnect',
  ConnectionString = 'ConnectionString'
}

export enum ProviderType {
  SqlServer = 'SqlServer'
}

export interface SetupRequest {
  userId: string
  connectionType: ConnectionType
  providerType: ProviderType
  serverName: string
  databaseName: string
  connectionString: string
}

export interface ProfileCreationResponse {
  profileId: string
  success: boolean
}

export interface LocalLLMHealthResponse {
  status: string // "healthy" or "unhealthy" or "warning"
  message: string
  checkedAt: string
  url: string
  checks?: {
    ollamaInstalled: boolean
    ollamaApiRunning: boolean
    modelAvailable: boolean
    modelRunning: boolean
  }
}

export interface LocalModelResponse {
  model: string
}

// User Service class for managing user operations
export class UserService {
  private userId: string | null = null

  constructor() {
    // Try to get userId from localStorage
    this.userId = localStorage.getItem('naturalToSql.userId')
  }

  async createOrGetUser(mode: 'groq' | 'local' | 'basic', apiKey?: string): Promise<UserInfoDto> {
    // Convert string mode to AIMode enum
    const aiMode = mode === 'groq' ? AIMode.Groq : 
                   mode === 'local' ? AIMode.Local : 
                   AIMode.Basic

    // If we already have a user, try to get it first
    if (this.userId) {
      try {
        const { apiService } = await import('../services/api')
        const existingUser = await apiService.getUserById(this.userId)
        if (existingUser) {
          // Update the mode if it's different
          if (existingUser.mode !== aiMode) {
            const updateRequest: UpdateAiModeRequest = {
              userId: this.userId,
              newAiMode: aiMode,
              apiKey: apiKey || ''
            }
            await apiService.updateUserAIMode(updateRequest)
            existingUser.mode = aiMode
          }
          return existingUser
        }
      } catch (error) {
        console.warn('Failed to get existing user, will create new one:', error)
        // Clear the invalid userId
        this.userId = null
        localStorage.removeItem('naturalToSql.userId')
      }
    }

    // Create a new user
    const { apiService } = await import('../services/api')
    const createRequest: CreateUserInfoRequest = {
      apiKey: apiKey || '', // Use provided API key or empty string
      mode: aiMode
    }

    const userResponse = await apiService.createUser(createRequest)
    if (!userResponse.success) {
      throw new Error(userResponse.message || 'Failed to create user')
    }

    // Get the full user info
    const user = await apiService.getUserById(userResponse.id)
    if (!user) {
      throw new Error('Failed to retrieve created user')
    }

    // Store the userId for future use
    this.userId = user.id
    localStorage.setItem('naturalToSql.userId', user.id)
    
    // Store setup type in localStorage for persistence
    localStorage.setItem('naturalToSql.setupType', mode)

    return user
  }

  async getUserProfiles(): Promise<ProfileDto[]> {
    if (!this.userId) {
      throw new Error('No user ID available')
    }

    const { apiService } = await import('../services/api')
    const user = await apiService.getUserById(this.userId)
    return user?.profiles || []
  }

  async updateUserMode(mode: 'groq' | 'local' | 'basic', apiKey?: string): Promise<void> {
    if (!this.userId) {
      throw new Error('No user ID available')
    }

    const aiMode = mode === 'groq' ? AIMode.Groq : 
                   mode === 'local' ? AIMode.Local : 
                   AIMode.Basic

    const { apiService } = await import('../services/api')
    const updateRequest: UpdateAiModeRequest = {
      userId: this.userId,
      newAiMode: aiMode,
      apiKey
    }

    await apiService.updateUserAIMode(updateRequest)
    
    // Update localStorage
    localStorage.setItem('naturalToSql.setupType', mode)
  }

  async createProfile(setupRequest: Omit<SetupRequest, 'userId'>): Promise<ProfileCreationResponse> {
    if (!this.userId) {
      throw new Error('No user ID available')
    }

    const { apiService } = await import('../services/api')
    const fullSetupRequest: SetupRequest = {
      ...setupRequest,
      userId: this.userId
    }

    return await apiService.createProfile(fullSetupRequest)
  }

  getCurrentUserId(): string | null {
    return this.userId
  }

  clearUser(): void {
    this.userId = null
    localStorage.removeItem('naturalToSql.userId')
    localStorage.removeItem('naturalToSql.setupType')
  }
}

// Export a singleton instance
export const userService = new UserService()
