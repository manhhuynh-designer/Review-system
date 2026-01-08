import type { File as FileType } from '@/types'

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Calculate total size from array of files
 */
export function calculateTotalSize(files: FileType[]): number {
    return files.reduce((total, file) => {
        const fileTotal = file.versions.reduce((verTotal, version) => {
            return verTotal + (version.metadata?.size || 0)
        }, 0)
        return total + fileTotal
    }, 0)
}

/**
 * Get storage percentage used
 */
export function getStoragePercentage(used: number, total: number): number {
    if (total === 0) return 0
    return Math.round((used / total) * 100)
}

/**
 * Get storage color based on percentage
 */
export function getStorageColor(percentage: number): 'green' | 'yellow' | 'red' {
    if (percentage < 50) return 'green'
    if (percentage < 80) return 'yellow'
    return 'red'
}

/**
 * Export data to JSON file and trigger download
 */
export function exportToJSON(data: any, filename: string): void {
    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()

    // Cleanup
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A'

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date)
}

/**
 * Get file type icon color
 */
export function getFileTypeColor(type: string): string {
    switch (type) {
        case 'image':
            return 'text-green-500'
        case 'video':
            return 'text-blue-500'
        case 'model':
            return 'text-purple-500'
        case 'sequence':
            return 'text-orange-500'
        default:
            return 'text-gray-500'
    }
}
