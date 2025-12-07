import { getDownloadURL, ref } from 'firebase/storage'
import { storage } from './firebase'

interface SecureUrlOptions {
  maxAge?: number // Cache duration in seconds
  fallbackUrl?: string
  requireAuth?: boolean
}

// Cache for generated URLs to avoid repeated API calls
const urlCache = new Map<string, { url: string; expiry: number }>()

/**
 * Securely get download URL for storage files with proper error handling
 */
export async function getSecureDownloadUrl(
  filePath: string, 
  options: SecureUrlOptions = {}
): Promise<string> {
  const { maxAge = 3600, fallbackUrl } = options
  
  try {
    // Check cache first
    const cached = urlCache.get(filePath)
    if (cached && Date.now() < cached.expiry) {
      return cached.url
    }
    
    // Validate file path to prevent path traversal
    if (!isValidStoragePath(filePath)) {
      throw new Error('Invalid file path')
    }
    
    // Get download URL from Firebase
    console.log(`🔄 Getting secure URL for: ${filePath}`)
    const storageRef = ref(storage, filePath)
    const downloadUrl = await getDownloadURL(storageRef)
    
    console.log(`✅ Secure URL obtained for: ${filePath}`)
    
    // Cache the result
    urlCache.set(filePath, {
      url: downloadUrl,
      expiry: Date.now() + (maxAge * 1000)
    })
    
    return downloadUrl
    
  } catch (error) {
    console.warn(`❌ Failed to get secure URL for ${filePath}:`, error)
    
    // Return fallback or throw based on configuration
    if (fallbackUrl) {
      console.log(`🔄 Using fallback URL for: ${filePath}`)
      return fallbackUrl
    }
    
    // For review pages, we want graceful degradation
    throw new Error(`File access denied: ${filePath}`)
  }
}

/**
 * Validate storage path to prevent security issues
 */
function isValidStoragePath(path: string): boolean {
  // Prevent path traversal attacks
  if (path.includes('../') || path.includes('..\\')) {
    return false
  }
  
  // Only allow specific patterns
  const allowedPatterns = [
    /^projects\/[a-zA-Z0-9_-]+\//,  // Project files
    /^comments\/[a-zA-Z0-9_-]+\//,  // Comment attachments
    /^public\//,                    // Public files
  ]
  
  return allowedPatterns.some(pattern => pattern.test(path))
}

/**
 * Batch get multiple secure URLs efficiently
 */
export async function getBatchSecureUrls(
  filePaths: string[], 
  options: SecureUrlOptions = {}
): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  
  // Process in batches to avoid overwhelming Firebase
  const batchSize = 10
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize)
    
    const batchPromises = batch.map(async (path) => {
      try {
        const url = await getSecureDownloadUrl(path, options)
        return { path, url }
      } catch (error) {
        console.warn(`Batch URL failed for ${path}:`, error)
        return { path, url: options.fallbackUrl || '' }
      }
    })
    
    const batchResults = await Promise.allSettled(batchPromises)
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.url) {
        results.set(result.value.path, result.value.url)
      }
    })
  }
  
  return results
}

/**
 * Clear URL cache (useful for testing or when files are updated)
 */
export function clearUrlCache(): void {
  urlCache.clear()
}

/**
 * Get cache stats for monitoring
 */
export function getCacheStats() {
  return {
    size: urlCache.size,
    entries: Array.from(urlCache.entries()).map(([path, data]) => ({
      path,
      expiry: new Date(data.expiry),
      isExpired: Date.now() > data.expiry
    }))
  }
}