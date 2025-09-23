import axios, { AxiosInstance, AxiosResponse } from 'axios'
import {
  DatabaseProvider,
  DatabaseServer,
  DatabaseInfo,
  ConnectionProfile,
  ConvertQueryRequest,
  ConvertQueryResponse,
  ExecuteQueryRequest,
  QueryResult,
  DatabaseSchema,
  HealthResponse,
  CreateUserInfoRequest,
  UserInfoResponse,
  UserInfoDto,
  UpdateAiModeRequest,
  SetupRequest,
  ProfileCreationResponse,
  LocalLLMHealthResponse,
  LocalModelResponse
} from '@/types'

class ApiService {
  private api: AxiosInstance
  
  // Simple request cache to prevent duplicate calls
  private requestCache: Map<string, Promise<any>> = new Map()

  constructor() {
    this.api = axios.create({
      baseURL: 'http://localhost:5000/api',
      timeout: 60000, // 1 minute default timeout, extended timeout is handled per-request
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error)
        throw this.formatError(error)
      }
    )
  }

  private formatError(error: any): any {
    if (error.response?.data) {
      // Return the exact API error format
      return error.response.data
    }
    
    // For network or other errors, create a compatible format
    return {
      source: 'Network Error',
      errors: {
        errorMessage: error.message || 'An unknown network error occurred',
        columns: [],
        rows: [],
        executionMs: 0,
        success: false,
        affectedRows: null
      },
      statusCode: error.response?.status || 0
    }
  }

  // Health check
  async checkHealth(): Promise<HealthResponse> {
    const response: AxiosResponse<HealthResponse> = await this.api.get('/health')
    return response.data
  }

  // Local LLM Health check
  async checkLocalLLMHealth(): Promise<LocalLLMHealthResponse> {
    const response: AxiosResponse<LocalLLMHealthResponse> = await this.api.get('/health/localllm')
    return response.data
  }

  // Get Local LLM Model info
  async getLocalLLMModel(): Promise<LocalModelResponse> {
    const response: AxiosResponse<LocalModelResponse> = await this.api.get('/userinfo/localllm')
    return response.data
  }

  // User Management endpoints
  async createUser(request: CreateUserInfoRequest): Promise<UserInfoResponse> {
    const response: AxiosResponse<UserInfoResponse> = await this.api.post('/userinfo', request)
    return response.data
  }

  async getUserById(userId: string): Promise<UserInfoDto> {
    const response: AxiosResponse<UserInfoDto> = await this.api.get(`/userinfo/${userId}`)
    return response.data
  }

  async getAllUsers(): Promise<UserInfoDto[]> {
    const response: AxiosResponse<UserInfoDto[]> = await this.api.get('/userinfo')
    return response.data
  }

  async updateUserAIMode(request: UpdateAiModeRequest): Promise<UserInfoDto> {
    const response: AxiosResponse<UserInfoDto> = await this.api.put(`/userinfo/${request.userId}/aimode`, request)
    return response.data
  }

  // Setup & Configuration endpoints
  async getSupportedProviders(): Promise<DatabaseProvider[]> {
    const cacheKey = 'getSupportedProviders'
    
    // Check if there's already a pending request
    if (this.requestCache.has(cacheKey)) {
      console.log('Returning cached request for getSupportedProviders')
      return this.requestCache.get(cacheKey)!
    }
    
    // Create new request and cache it
    const request = this._getSupportedProvidersInternal()
    this.requestCache.set(cacheKey, request)
    
    try {
      const result = await request
      return result
    } finally {
      // Remove from cache after completion (success or failure)
      this.requestCache.delete(cacheKey)
    }
  }

  private async _getSupportedProvidersInternal(): Promise<DatabaseProvider[]> {
    const response: AxiosResponse<DatabaseProvider[]> = await this.api.get('/setup/providers')
    return response.data
  }

  async getExistingProfiles(): Promise<ConnectionProfile[]> {
    const response: AxiosResponse<any[]> = await this.api.get('/setup/profiles')
    
    // Transform API response to match our interface
    return response.data.map((profile: any) => {
      const serverName = this.extractServerNameFromConnectionString(profile.connectionString)
      
      return {
        id: profile.id,
        name: profile.name,
        connectionString: profile.connectionString || '',
        queries: profile.queries || [],
        createdUtc: profile.createdUtc,
        
        // Use databaseName from API response (now available)
        databaseName: profile.databaseName,
        serverName: serverName,
        providerType: 'SqlServer', // Default since we only see SqlServer in the logs
        
        // Legacy fields for backward compatibility
        provider: 'SqlServer', // SqlServer enum string value
        secretRef: profile.secretRef,
        cacheFile: profile.cacheFile
      }
    })
  }

  async getUserProfiles(userId: string): Promise<ConnectionProfile[]> {
    // Get user data which includes profiles
    const userData = await this.getUserById(userId)
    
    // Transform profiles to match our interface
    return userData.profiles.map((profile: any) => {
      return {
        id: profile.id,
        name: profile.name,
        connectionString: '', // Will be fetched separately if needed
        queries: [],
        createdUtc: profile.createdUtc,
        databaseName: profile.databaseName,
        serverName: 'Unknown Server', // Will be populated from connection string if available
        providerType: 'SqlServer',
        provider: profile.provider,
        secretRef: profile.secretRef,
        cacheFile: profile.cacheFile
      }
    })
  }

  private extractServerNameFromConnectionString(connectionString: string): string {
    if (!connectionString) return 'Unknown Server'
    
    // Try different server name patterns
    const patterns = [
      /Data Source=([^;]+)/i,
      /Server=([^;]+)/i,
      /DataSource=([^;]+)/i
    ]
    
    for (const pattern of patterns) {
      const match = connectionString.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }
    
    return 'Unknown Server'
  }

  async getAvailableServers(providerType: string): Promise<DatabaseServer[]> {
    const response: AxiosResponse<DatabaseServer[]> = await this.api.get(`/setup/servers/${providerType}`)
    return response.data
  }

  async getAvailableDatabases(providerType: string, serverName: string): Promise<DatabaseInfo[]> {
    const encodedServerName = encodeURIComponent(serverName)
    const response: AxiosResponse<DatabaseInfo[]> = await this.api.get(`/setup/databases/${providerType}/${encodedServerName}`)
    return response.data
  }

  async testConnection(providerType: string, connectionString: string): Promise<{ success: boolean }> {
    // Use POST method with JSON body as the backend expects
    const response: AxiosResponse<{ success: boolean }> = await this.api.post(`/setup/test/${providerType}`, {
      ConnectionString: connectionString
    })
    return response.data
  }

  async createProfile(request: SetupRequest): Promise<ProfileCreationResponse> {
    const response: AxiosResponse<ProfileCreationResponse> = await this.api.post('/setup/profile', request)
    return response.data
  }

  async removeProfile(profileId: string): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await this.api.delete(`/setup/profile/${profileId}`)
    return response.data
  }

  // Query endpoints
  async getProfile(profileId: string): Promise<ConnectionProfile> {
    const response: AxiosResponse<ConnectionProfile> = await this.api.get(`/query/profile/${profileId}`)
    return response.data
  }

  async convertQuery(request: ConvertQueryRequest): Promise<ConvertQueryResponse> {
    const response: AxiosResponse<ConvertQueryResponse> = await this.api.post(`/query/${request.profileId}/convert`, request)
    return response.data
  }

  // Convert query with extended timeout for local mode
  async convertQueryWithTimeout(request: ConvertQueryRequest, timeoutMs: number): Promise<ConvertQueryResponse> {
    const response: AxiosResponse<ConvertQueryResponse> = await this.api.post(
      `/query/${request.profileId}/convert`, 
      request,
      { timeout: timeoutMs }
    )
    return response.data
  }

  async executeQuery(request: ExecuteQueryRequest): Promise<QueryResult> {
    const response: AxiosResponse<QueryResult> = await this.api.post(`/query/${request.profileId}/execute`, request)
    return response.data
  }

  async getSchema(profileId: string): Promise<DatabaseSchema> {
    const response: AxiosResponse<DatabaseSchema> = await this.api.get(`/query/${profileId}/schema`)
    return response.data
  }

  // Groq API Key Management
  async testGroqApiKey(apiKey: string): Promise<{ valid: boolean; message?: string }> {
    try {
      if (!apiKey || !apiKey.trim()) {
        return { valid: false, message: 'API key is required' }
      }

      // Test the API key directly against Groq's API
      const testUrl = 'https://api.groq.com/openai/v1/models'
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        return { valid: true, message: 'API key is valid and working' }
      } else if (response.status === 401) {
        return { valid: false, message: 'Invalid API key or unauthorized access' }
      } else if (response.status === 403) {
        return { valid: false, message: 'API key does not have required permissions' }
      } else if (response.status === 429) {
        return { valid: false, message: 'Rate limit exceeded. Please try again later' }
      } else {
        return { valid: false, message: `API request failed with status ${response.status}` }
      }
    } catch (error: any) {
      console.error('Error testing Groq API key:', error)
      
      // Check for network errors and provide fallback validation
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        // Network error - fall back to basic format validation
        const keyPattern = /^gsk_[a-zA-Z0-9]{48,}$/
        const isValidFormat = keyPattern.test(apiKey.trim())
        
        if (isValidFormat) {
          return { valid: true, message: 'API key format is valid (network test failed - please verify connectivity)' }
        } else {
          return { valid: false, message: 'Invalid API key format. Groq keys should start with "gsk_" and be at least 51 characters long' }
        }
      }
      
      return { valid: false, message: 'Failed to test API key. Please check your internet connection.' }
    }
  }

  async saveGroqApiKey(apiKey: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Use electron IPC to save to appsettings.json
      if (window.electronAPI && window.electronAPI.saveGroqApiKey) {
        await window.electronAPI.saveGroqApiKey(apiKey)
        return { success: true, message: 'API key saved to configuration file' }
      } else {
        // Fallback to localStorage for development
        localStorage.setItem('naturalToSql.groqApiKey', apiKey)
        return { success: true, message: 'API key saved locally (development mode)' }
      }
    } catch (error) {
      console.error('Failed to save API key:', error)
      return { success: false, message: 'Failed to save API key' }
    }
  }

  async getGroqApiKeyStatus(): Promise<{ hasApiKey: boolean; keyPrefix?: string }> {
    try {
      // Use electron IPC to check appsettings.json
      if (window.electronAPI && window.electronAPI.getGroqApiKeyStatus) {
        const result = await window.electronAPI.getGroqApiKeyStatus()
        return result
      } else {
        // Fallback to localStorage for development
        const apiKey = localStorage.getItem('naturalToSql.groqApiKey')
        if (apiKey && apiKey.trim()) {
          return { 
            hasApiKey: true, 
            keyPrefix: apiKey.substring(0, 8) + '...' 
          }
        } else {
          return { hasApiKey: false }
        }
      }
    } catch (error) {
      console.error('Failed to check API key status:', error)
      return { hasApiKey: false }
    }
  }
}

export const apiService = new ApiService()
export default apiService
