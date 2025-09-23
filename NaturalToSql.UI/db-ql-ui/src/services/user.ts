import { apiService } from './api'
import { AIMode, CreateUserInfoRequest, UserInfoDto } from '@/types'

class UserService {
  private readonly USER_ID_KEY = 'naturalToSql.userId'
  private readonly SETUP_TYPE_KEY = 'naturalToSql.setupType'

  // Get stored user ID
  getUserId(): string | null {
    return localStorage.getItem(this.USER_ID_KEY)
  }

  // Store user ID
  private setUserId(userId: string): void {
    localStorage.setItem(this.USER_ID_KEY, userId)
  }

  // Remove user ID
  private clearUserId(): void {
    localStorage.removeItem(this.USER_ID_KEY)
  }

  // Convert setup type string to AIMode enum
  private getAIModeFromSetupType(setupType: string): AIMode {
    switch (setupType.toLowerCase()) {
      case 'groq':
        return AIMode.Groq
      case 'local':
        return AIMode.Local
      case 'basic':
        return AIMode.Basic
      default:
        return AIMode.Basic
    }
  }

  // Convert AIMode enum to setup type string
  private getSetupTypeFromAIMode(mode: AIMode): string {
    switch (mode) {
      case AIMode.Groq:
        return 'groq'
      case AIMode.Local:
        return 'local'
      case AIMode.Basic:
        return 'basic'
      default:
        return 'basic'
    }
  }

  // Check if this is first initialization
  async isFirstInitialization(): Promise<boolean> {
    try {
      // Check if we have a stored user ID
      const storedUserId = this.getUserId()
      if (storedUserId) {
        // Try to fetch the user to verify it exists
        try {
          await apiService.getUserById(storedUserId)
          return false // User exists, not first initialization
        } catch (error) {
          // User doesn't exist, clear stored ID and treat as first initialization
          console.warn('Stored user ID is invalid, clearing and treating as first initialization')
          this.clearUserId()
          return true
        }
      }

      // Check if there are any users in the system
      const allUsers = await apiService.getAllUsers()
      return allUsers.length === 0
    } catch (error) {
      console.error('Error checking first initialization:', error)
      return true // Default to first initialization on error
    }
  }

  // Create or get user (combines creation and retrieval logic)
  async createOrGetUser(mode: 'groq' | 'local' | 'basic', apiKey?: string): Promise<UserInfoDto> {
    try {
      // Check if user already exists
      const existingUser = await this.getCurrentUser()
      if (existingUser) {
        // Update mode if different
        const currentMode = this.getSetupTypeFromAIMode(existingUser.mode)
        if (currentMode !== mode) {
          await this.updateUserMode(mode, apiKey)
          // Fetch updated user data
          const updatedUser = await this.getCurrentUser()
          if (updatedUser) {
            return updatedUser
          }
        }
        return existingUser
      }

      // Create new user
      const userId = await this.createUserProfile(mode, apiKey)
      const newUser = await apiService.getUserById(userId)
      return newUser
    } catch (error) {
      console.error('Error in createOrGetUser:', error)
      throw error
    }
  }

  // Create user profile (first time setup)
  async createUserProfile(mode: 'groq' | 'local' | 'basic', apiKey?: string): Promise<string> {
    try {
      console.log('🔑 createUserProfile called with mode:', mode, 'apiKey:', apiKey ? `"${apiKey}" (length: ${apiKey.length})` : 'null/undefined')
      
      const aiMode = this.getAIModeFromSetupType(mode)
      
      const request: CreateUserInfoRequest = {
        apiKey: apiKey || '',
        mode: aiMode
      }

      console.log('📤 Sending request to API:', { ...request, apiKey: request.apiKey ? `"${request.apiKey}" (length: ${request.apiKey.length})` : 'empty string' })
      
      const response = await apiService.createUser(request)
      
      if (response.success) {
        // Store user ID locally
        this.setUserId(response.id)
        
        // Store setup type for compatibility
        localStorage.setItem(this.SETUP_TYPE_KEY, mode)
        
        return response.id
      } else {
        throw new Error(response.message || 'Failed to create user profile')
      }
    } catch (error) {
      console.error('Error creating user profile:', error)
      throw error
    }
  }

  // Get current user data
  async getCurrentUser(): Promise<UserInfoDto | null> {
    try {
      const userId = this.getUserId()
      if (!userId) {
        return null
      }

      const userData = await apiService.getUserById(userId)
      
      // Update local setup type to match user's current mode
      const setupType = this.getSetupTypeFromAIMode(userData.mode)
      localStorage.setItem(this.SETUP_TYPE_KEY, setupType)
      
      return userData
    } catch (error) {
      console.error('Error getting current user:', error)
      // Clear invalid user ID
      this.clearUserId()
      return null
    }
  }

  // Update user's AI mode
  async updateUserMode(mode: 'groq' | 'local' | 'basic', apiKey?: string): Promise<void> {
    try {
      const userId = this.getUserId()
      if (!userId) {
        throw new Error('No user ID found. Please create a user profile first.')
      }

      const aiMode = this.getAIModeFromSetupType(mode)
      
      const request = {
        userId: userId,
        apiKey: apiKey || '',
        newAiMode: aiMode
      }

      await apiService.updateUserAIMode(request)
      
      // Update local setup type
      localStorage.setItem(this.SETUP_TYPE_KEY, mode)
    } catch (error) {
      console.error('Error updating user mode:', error)
      throw error
    }
  }

  // Get user's profiles
  async getUserProfiles(): Promise<any[]> {
    try {
      const userId = this.getUserId()
      if (!userId) {
        return []
      }

      return await apiService.getUserProfiles(userId)
    } catch (error) {
      console.error('Error getting user profiles:', error)
      return []
    }
  }

  // Create profile with automatic userId injection
  async createProfile(setupRequest: Omit<import('@/types/user').SetupRequest, 'userId'>): Promise<import('@/types/user').ProfileCreationResponse> {
    const userId = this.getUserId()
    if (!userId) {
      throw new Error('No user ID available. Please complete initial setup first.')
    }

    const fullSetupRequest: import('@/types/user').SetupRequest = {
      ...setupRequest,
      userId: userId
    }

    return await apiService.createProfile(fullSetupRequest)
  }

  // Validate API key for Groq mode
  async validateGroqApiKey(apiKey: string): Promise<{ valid: boolean; message?: string }> {
    return await apiService.testGroqApiKey(apiKey)
  }
}

export const userService = new UserService()
export default userService
