import { create } from 'zustand'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Project, File as FileType, Comment } from '../types'

interface StorageStats {
    totalSize: number
    fileCount: number
    byType: {
        image: number
        video: number
        model: number
        sequence: number
    }
}

interface ProjectStats {
    projectId: string
    projectName: string
    fileCount: number
    commentCount: number
    totalSize: number
    status: 'active' | 'archived' | 'trash'
}

interface CommentStats {
    total: number
    resolved: number
    pending: number
    withAttachments: number
}

interface FileWithProject extends FileType {
    projectName?: string
    projectStatus?: 'active' | 'archived' | 'trash'
}

interface ExportData {
    exportDate: string
    adminEmail: string
    summary: {
        totalProjects: number
        totalFiles: number
        totalComments: number
        totalStorageBytes: number
    }
    projects: Project[]
    files: FileWithProject[]
    comments: Comment[]
}

interface StatisticsState {
    loading: boolean
    storageStats: StorageStats | null
    projectStats: ProjectStats[]
    commentStats: CommentStats | null
    largestFiles: FileWithProject[]

    // Actions
    calculateStorageUsage: (adminEmail: string) => Promise<StorageStats>
    getProjectStatistics: (adminEmail: string) => Promise<ProjectStats[]>
    getFileTypeBreakdown: (adminEmail: string) => Promise<StorageStats['byType']>
    getCommentStatistics: (adminEmail: string) => Promise<CommentStats>
    getLargestFiles: (adminEmail: string, limit?: number) => Promise<FileWithProject[]>
    exportData: (adminEmail: string, type: 'files' | 'comments' | 'all') => Promise<ExportData>

    // Reset
    reset: () => void
}

export type { ExportData }

const STORAGE_FREE_TIER_LIMIT = 5 * 1024 * 1024 * 1024 // 5GB in bytes

export const useStatisticsStore = create<StatisticsState>((set, get) => ({
    loading: false,
    storageStats: null,
    projectStats: [],
    commentStats: null,
    largestFiles: [],

    calculateStorageUsage: async (adminEmail: string) => {
        set({ loading: true })
        try {
            // Get all projects for this admin
            const projectsQuery = query(
                collection(db, 'projects'),
                where('adminEmail', '==', adminEmail)
            )
            const projectsSnapshot = await getDocs(projectsQuery)
            const projectIds = projectsSnapshot.docs.map(doc => doc.id)

            if (projectIds.length === 0) {
                const emptyStats: StorageStats = {
                    totalSize: 0,
                    fileCount: 0,
                    byType: { image: 0, video: 0, model: 0, sequence: 0 }
                }
                set({ storageStats: emptyStats })
                return emptyStats
            }

            // Get all files for these projects
            const filesQuery = query(
                collection(db, 'files'),
                where('projectId', 'in', projectIds.slice(0, 10)) // Firestore limit: 10 items in 'in' query
            )
            const filesSnapshot = await getDocs(filesQuery)

            let totalSize = 0
            let fileCount = 0
            const byType = { image: 0, video: 0, model: 0, sequence: 0 }

            filesSnapshot.docs.forEach(doc => {
                const file = doc.data() as FileType
                fileCount++

                // Calculate size from all versions
                const fileTotalSize = file.versions.reduce((acc, v) => acc + (v.metadata?.size || 0), 0)
                totalSize += fileTotalSize

                // Add to type breakdown
                if (file.type in byType) {
                    byType[file.type as keyof typeof byType] += fileTotalSize
                }
            })

            // If there are more than 10 projects, we need to batch the queries
            if (projectIds.length > 10) {
                for (let i = 10; i < projectIds.length; i += 10) {
                    const batch = projectIds.slice(i, i + 10)
                    const batchQuery = query(
                        collection(db, 'files'),
                        where('projectId', 'in', batch)
                    )
                    const batchSnapshot = await getDocs(batchQuery)

                    batchSnapshot.docs.forEach(doc => {
                        const file = doc.data() as FileType
                        fileCount++

                        // Calculate size from all versions
                        const fileTotalSize = file.versions.reduce((acc, v) => acc + (v.metadata?.size || 0), 0)
                        totalSize += fileTotalSize

                        if (file.type in byType) {
                            byType[file.type as keyof typeof byType] += fileTotalSize
                        }
                    })
                }
            }

            const stats: StorageStats = { totalSize, fileCount, byType }
            set({ storageStats: stats })
            return stats
        } catch (error) {
            console.error('Error calculating storage usage:', error)
            throw error
        } finally {
            set({ loading: false })
        }
    },

    getProjectStatistics: async (adminEmail: string) => {
        set({ loading: true })
        try {
            // Get all projects
            const projectsQuery = query(
                collection(db, 'projects'),
                where('adminEmail', '==', adminEmail)
            )
            const projectsSnapshot = await getDocs(projectsQuery)
            const projects = projectsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Project[]

            const projectStats: ProjectStats[] = []

            for (const project of projects) {
                // Get files for this project
                const filesQuery = query(
                    collection(db, 'files'),
                    where('projectId', '==', project.id)
                )
                const filesSnapshot = await getDocs(filesQuery)

                let totalSize = 0
                filesSnapshot.docs.forEach(doc => {
                    const file = doc.data() as FileType
                    const fileTotalSize = file.versions.reduce((acc, v) => acc + (v.metadata?.size || 0), 0)
                    totalSize += fileTotalSize
                })

                // Get comments for this project
                const commentsQuery = query(
                    collection(db, 'comments'),
                    where('projectId', '==', project.id)
                )
                const commentsSnapshot = await getDocs(commentsQuery)

                projectStats.push({
                    projectId: project.id,
                    projectName: project.name,
                    fileCount: filesSnapshot.size,
                    commentCount: commentsSnapshot.size,
                    totalSize,
                    status: project.status
                })
            }

            // Sort by totalSize descending
            projectStats.sort((a, b) => b.totalSize - a.totalSize)

            set({ projectStats })
            return projectStats
        } catch (error) {
            console.error('Error getting project statistics:', error)
            throw error
        } finally {
            set({ loading: false })
        }
    },

    getFileTypeBreakdown: async (adminEmail: string) => {
        const stats = await get().calculateStorageUsage(adminEmail)
        return stats.byType
    },

    getCommentStatistics: async (adminEmail: string) => {
        set({ loading: true })
        try {
            // Get all projects for this admin
            const projectsQuery = query(
                collection(db, 'projects'),
                where('adminEmail', '==', adminEmail)
            )
            const projectsSnapshot = await getDocs(projectsQuery)
            const projectIds = projectsSnapshot.docs.map(doc => doc.id)

            if (projectIds.length === 0) {
                const emptyStats: CommentStats = {
                    total: 0,
                    resolved: 0,
                    pending: 0,
                    withAttachments: 0
                }
                set({ commentStats: emptyStats })
                return emptyStats
            }

            let total = 0
            let resolved = 0
            let pending = 0
            let withAttachments = 0

            // Query comments in batches (Firestore 'in' limit is 10)
            for (let i = 0; i < projectIds.length; i += 10) {
                const batch = projectIds.slice(i, i + 10)
                const commentsQuery = query(
                    collection(db, 'comments'),
                    where('projectId', 'in', batch)
                )
                const commentsSnapshot = await getDocs(commentsQuery)

                commentsSnapshot.docs.forEach(doc => {
                    const comment = doc.data() as Comment
                    total++

                    if (comment.isResolved) {
                        resolved++
                    } else {
                        pending++
                    }

                    if (comment.attachments && comment.attachments.length > 0) {
                        withAttachments++
                    }
                })
            }

            const stats: CommentStats = { total, resolved, pending, withAttachments }
            set({ commentStats: stats })
            return stats
        } catch (error) {
            console.error('Error getting comment statistics:', error)
            throw error
        } finally {
            set({ loading: false })
        }
    },

    getLargestFiles: async (adminEmail: string, limit = 20) => {
        set({ loading: true })
        try {
            // Get all projects
            const projectsQuery = query(
                collection(db, 'projects'),
                where('adminEmail', '==', adminEmail)
            )
            const projectsSnapshot = await getDocs(projectsQuery)
            const projects = projectsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Project[]

            // Get all files
            const allFiles: FileWithProject[] = []

            for (const project of projects) {
                const filesQuery = query(
                    collection(db, 'files'),
                    where('projectId', '==', project.id)
                )
                const filesSnapshot = await getDocs(filesQuery)

                filesSnapshot.docs.forEach(doc => {
                    const file = doc.data() as FileType
                    const currentVersion = file.versions.find(v => v.version === file.currentVersion)

                    if (currentVersion) {
                        allFiles.push({
                            ...file,
                            id: doc.id,
                            projectName: project.name,
                            projectStatus: project.status
                        })
                    }
                })
            }

            // Sort by total size (all versions) descending
            allFiles.sort((a, b) => {
                const sizeA = a.versions.reduce((acc, v) => acc + (v.metadata?.size || 0), 0)
                const sizeB = b.versions.reduce((acc, v) => acc + (v.metadata?.size || 0), 0)
                return sizeB - sizeA
            })

            const largestFiles = allFiles.slice(0, limit)
            set({ largestFiles })
            return largestFiles
        } catch (error) {
            console.error('Error getting largest files:', error)
            throw error
        } finally {
            set({ loading: false })
        }
    },

    exportData: async (adminEmail: string, type: 'files' | 'comments' | 'all') => {
        set({ loading: true })
        try {
            // Get all projects
            const projectsQuery = query(
                collection(db, 'projects'),
                where('adminEmail', '==', adminEmail)
            )
            const projectsSnapshot = await getDocs(projectsQuery)
            const projects = projectsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Project[]

            const projectIds = projects.map(p => p.id)

            let files: FileWithProject[] = []
            const comments: Comment[] = []

            // Get files if needed
            if (type === 'files' || type === 'all') {
                for (const project of projects) {
                    const filesQuery = query(
                        collection(db, 'files'),
                        where('projectId', '==', project.id)
                    )
                    const filesSnapshot = await getDocs(filesQuery)

                    filesSnapshot.docs.forEach(doc => {
                        files.push({
                            ...doc.data() as FileType,
                            id: doc.id,
                            projectName: project.name,
                            projectStatus: project.status
                        })
                    })
                }
            }

            // Get comments if needed
            if (type === 'comments' || type === 'all') {
                for (let i = 0; i < projectIds.length; i += 10) {
                    const batch = projectIds.slice(i, i + 10)
                    const commentsQuery = query(
                        collection(db, 'comments'),
                        where('projectId', 'in', batch)
                    )
                    const commentsSnapshot = await getDocs(commentsQuery)

                    commentsSnapshot.docs.forEach(doc => {
                        comments.push({
                            ...doc.data() as Comment,
                            id: doc.id
                        })
                    })
                }
            }

            // Calculate total storage
            let totalStorageBytes = 0
            files.forEach(file => {
                const fileTotalSize = file.versions.reduce((acc, v) => acc + (v.metadata?.size || 0), 0)
                totalStorageBytes += fileTotalSize
            })

            const exportData: ExportData = {
                exportDate: new Date().toISOString(),
                adminEmail,
                summary: {
                    totalProjects: projects.length,
                    totalFiles: files.length,
                    totalComments: comments.length,
                    totalStorageBytes
                },
                projects: type === 'all' ? projects : [],
                files,
                comments
            }

            return exportData
        } catch (error) {
            console.error('Error exporting data:', error)
            throw error
        } finally {
            set({ loading: false })
        }
    },

    reset: () => {
        set({
            loading: false,
            storageStats: null,
            projectStats: [],
            commentStats: null,
            largestFiles: []
        })
    }
}))

export { STORAGE_FREE_TIER_LIMIT }
