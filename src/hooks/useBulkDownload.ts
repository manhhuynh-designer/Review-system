import { useState } from 'react'
import JSZip from 'jszip'
import toast from 'react-hot-toast'
import type { File as FileType, Comment } from '@/types'

// Helper for file extension
const getFileExtension = (url: string, mimeType?: string, fileType?: string): string => {
    // Try to extract from URL first (works for direct storage paths)
    let urlMatch = url.match(/\.([^./?#]+)(?=[?#]|$)/)

    if (!urlMatch && url.includes('%2F')) {
        // Try to find extension in encoded URL path
        const decoded = decodeURIComponent(url.split('?')[0])
        urlMatch = decoded.match(/\.([^./?#]+)$/)
    }

    if (urlMatch) {
        const ext = urlMatch[1].toLowerCase()
        if (ext === 'jpeg') return '.jpg'
        return `.${ext}`
    }

    if (mimeType) {
        const mimeMap: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/quicktime': '.mov',
            'video/x-msvideo': '.avi',
            'application/pdf': '.pdf',
            'model/gltf-binary': '.glb',
            'model/gltf+json': '.gltf',
            'application/octet-stream': ''
        }

        if (mimeMap[mimeType]) return mimeMap[mimeType]

        // Fallback: extract from MIME type
        const ext = mimeType.split('/')[1]?.split('+')[0]?.split(';')[0]
        if (ext && ext !== 'octet-stream') {
            return `.${ext.replace('jpeg', 'jpg')}`
        }
    }

    // Fallback based on file type
    const typeMap: Record<string, string> = {
        'image': '.jpg',
        'video': '.mp4',
        'pdf': '.pdf',
        'model': '.glb',
        'sequence': '.jpg'
    }

    return typeMap[fileType || ''] || ''
}

const ensureFileExtension = (filename: string, url: string, mimeType?: string, fileType?: string): string => {
    const correctExt = getFileExtension(url, mimeType, fileType)

    if (!correctExt) return filename

    const hasExtension = /\.[a-zA-Z0-9]+$/.test(filename)
    if (hasExtension) {
        return filename.replace(/\.[^.]+$/, correctExt)
    }

    return `${filename}${correctExt}`
}

export interface UseBulkDownloadReturn {
    handleBulkDownload: (filesToDownload: FileType[], comments?: Comment[]) => Promise<void>
    isDownloading: boolean
    downloadProgress: number
    downloadMessage: string
    currentDownloadFile: string
}

export function useBulkDownload(): UseBulkDownloadReturn {
    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState(0)
    const [downloadMessage, setDownloadMessage] = useState('')
    const [currentDownloadFile, setCurrentDownloadFile] = useState('')

    const handleBulkDownload = async (filesToDownload: FileType[], comments: Comment[] = []) => {
        if (filesToDownload.length === 0) return

        setIsDownloading(true)
        setDownloadProgress(0)
        setDownloadMessage('Đang chuẩn bị...')

        try {
            const zip = new JSZip()

            // Calculate total items for progress
            let totalItems = 0
            for (const file of filesToDownload) {
                const currentVersion = file.versions.find(v => v.version === file.currentVersion)
                if (file.type === 'sequence' && currentVersion?.sequenceUrls) {
                    totalItems += currentVersion.sequenceUrls.length
                } else {
                    totalItems += 1
                }
            }

            let processedItems = 0
            let successCount = 0
            let errorCount = 0

            for (const file of filesToDownload) {
                const currentVersion = file.versions.find(v => v.version === file.currentVersion)
                if (!currentVersion?.url) {
                    console.warn(`No URL found for file: ${file.name}`)
                    errorCount++
                    continue
                }

                setCurrentDownloadFile(file.name)

                try {
                    // For sequences, create a subfolder
                    if (file.type === 'sequence' && currentVersion?.sequenceUrls && currentVersion.sequenceUrls.length > 0) {
                        const folderName = file.name.replace(/\.[^/.]+$/, '') || file.name
                        const folder = zip.folder(folderName)
                        if (!folder) {
                            errorCount++
                            continue
                        }

                        // Add all sequence frames to the folder
                        for (let i = 0; i < currentVersion.sequenceUrls.length; i++) {
                            try {
                                setDownloadMessage(`Đang tải frame ${i + 1}/${currentVersion.sequenceUrls.length} của ${file.name}`)
                                const frameResponse = await fetch(currentVersion.sequenceUrls[i])
                                if (frameResponse.ok) {
                                    const frameBlob = await frameResponse.blob()
                                    const ext = getFileExtension(currentVersion.sequenceUrls[i], frameBlob.type)
                                    const frameName = `frame_${String(i + 1).padStart(4, '0')}${ext || '.jpg'}`
                                    folder.file(frameName, frameBlob)
                                }
                            } catch (err) {
                                console.error(`Error fetching frame ${i}:`, err)
                            }
                            processedItems++
                            setDownloadProgress((processedItems / totalItems) * 80)
                        }

                        // Add comments for sequence
                        const fileComments = comments.filter(c => c.fileId === file.id)
                        if (fileComments.length > 0) {
                            const commentsText = fileComments.map(c => {
                                // Safe date handling
                                const date = c.createdAt && typeof c.createdAt.toDate === 'function'
                                    ? c.createdAt.toDate()
                                    : new Date()

                                return `[${c.isResolved ? 'RESOLVED' : 'PENDING'}] ${c.userName} (${date.toLocaleString('vi-VN')}):\n${c.content}\n${c.annotationData ? `Frame: ${c.timestamp || 0}s` : ''}\n`
                            }).join('\n---\n\n')
                            folder.file('comments.txt', commentsText)
                        }

                        successCount++
                    } else {
                        // Single file download
                        setDownloadMessage(`Đang tải ${file.name}...`)
                        const response = await fetch(currentVersion.url)
                        if (!response.ok) throw new Error(`Failed to fetch ${file.name}`)

                        const blob = await response.blob()

                        // Ensure file has correct extension
                        const fileName = ensureFileExtension(file.name, currentVersion.url, blob.type, file.type)

                        zip.file(fileName, blob)

                        // Add comments for single file
                        const fileComments = comments.filter(c => c.fileId === file.id)
                        if (fileComments.length > 0) {
                            const commentsText = fileComments.map(c => {
                                const date = c.createdAt && typeof c.createdAt.toDate === 'function'
                                    ? c.createdAt.toDate()
                                    : new Date()

                                return `[${c.isResolved ? 'RESOLVED' : 'PENDING'}] ${c.userName} (${date.toLocaleString('vi-VN')}):\n${c.content}\n${c.annotationData ? `Annotation at ${c.timestamp || 0}s` : ''}\n`
                            }).join('\n---\n\n')

                            const commentFileName = fileName.replace(/\.[^/.]+$/, '') + '_comments.txt'
                            zip.file(commentFileName, commentsText)
                        }

                        processedItems++
                        setDownloadProgress((processedItems / totalItems) * 80)
                        successCount++
                    }
                } catch (error) {
                    console.error(`Error downloading file ${file.name}:`, error)
                    errorCount++
                }
            }

            if (successCount === 0) {
                toast.error('Không thể tải xuống files')
                setIsDownloading(false)
                return
            }

            // Generate ZIP file
            setDownloadMessage('Đang nén files...')
            setCurrentDownloadFile('')
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            }, (metadata) => {
                setDownloadProgress(80 + (metadata.percent * 0.2))
            })

            // Download ZIP
            const timestamp = new Date().toISOString().split('T')[0]
            const filename = `files-download-${timestamp}.zip`

            const link = document.createElement('a')
            link.href = URL.createObjectURL(zipBlob)
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(link.href)

            toast.success(`Đã tải xuống ${successCount} files${errorCount > 0 ? ` (${errorCount} lỗi)` : ''}`)
        } catch (error) {
            console.error('Bulk download error:', error)
            toast.error('Lỗi khi tải files')
        } finally {
            setIsDownloading(false)
            setDownloadProgress(0)
        }
    }

    return {
        handleBulkDownload,
        isDownloading,
        downloadProgress,
        downloadMessage,
        currentDownloadFile
    }
}
