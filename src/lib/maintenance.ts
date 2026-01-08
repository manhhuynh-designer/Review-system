import { ref, listAll, deleteObject, getMetadata } from 'firebase/storage'
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore'
import { db, storage } from './firebase'
import type { Project, File as FileType } from '@/types'

export interface OrphanedItem {
    path: string
    type: 'project' | 'file' | 'version'
    size: number
    reason: string
    projectId: string
    fileId?: string
    version?: number
}

// Helper to list all items recursively (depth limited for safety)
// For 'Safe Scan', we only look inside known projects.
// Structure: projects/{projectId}/{fileId}/{version}/{filename}

export async function scanForOrphans(adminEmail: string): Promise<OrphanedItem[]> {
    const orphans: OrphanedItem[] = []

    try {
        // 1. Get all projects for this admin
        const projectsQuery = query(
            collection(db, 'projects'),
            where('adminEmail', '==', adminEmail)
        )
        const projectsGeneric = await getDocs(projectsQuery)
        const projects = projectsGeneric.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project))

        // 2. For each project, scan storage
        for (const project of projects) {
            const projectRef = ref(storage, `projects/${project.id}`)

            try {
                // List files/folders in project root
                const projectRes = await listAll(projectRef)

                // Expect folders (fileIds)
                for (const fileFolderRef of projectRes.prefixes) {
                    const fileId = fileFolderRef.name

                    // Check if file exists in Firestore
                    // OPTIMIZATION: We could fetch ALL files for project once instead of 1-by-1
                    // But for robustness, let's verify via Firestore query if we don't have a local map

                    // Let's assume we can fetch all files for the project to cache
                    // (This is done efficiently in useStatisticsStore, we can mimic that or reuse if passed in)

                    // For now, let's query Firestore for this specific fileId to be sure
                    const fileDocRef = doc(db, 'projects', project.id, 'files', fileId)
                    const fileDoc = await getDoc(fileDocRef)

                    if (!fileDoc.exists()) {
                        // ORPHAN FILE: File folder exists in storage but not in Firestore
                        // We need to calculate size to report it
                        const size = await calculateFolderSize(fileFolderRef.fullPath)
                        orphans.push({
                            path: fileFolderRef.fullPath,
                            type: 'file',
                            size,
                            reason: 'File document not found in Firestore',
                            projectId: project.id,
                            fileId
                        })
                    } else {
                        // File exists, check for orphan VERSIONS
                        const fileData = fileDoc.data() as FileType
                        const validVersions = new Set(fileData.versions.map(v => v.version))

                        // List versions in file folder
                        const fileRes = await listAll(fileFolderRef)

                        // Expect folders like "v1", "v2"
                        for (const versionFolderRef of fileRes.prefixes) {
                            const folderName = versionFolderRef.name
                            // Expect "v{number}"
                            if (folderName.startsWith('v')) {
                                const versionNum = parseInt(folderName.substring(1))
                                if (!isNaN(versionNum) && !validVersions.has(versionNum)) {
                                    // ORPHAN VERSION: Version folder exists but not in Firestore file versions
                                    const size = await calculateFolderSize(versionFolderRef.fullPath)
                                    orphans.push({
                                        path: versionFolderRef.fullPath,
                                        type: 'version',
                                        size,
                                        reason: `Version v${versionNum} not found in Firestore`,
                                        projectId: project.id,
                                        fileId,
                                        version: versionNum
                                    })
                                }
                            }
                        }
                    }
                }

            } catch (err) {
                console.warn(`Error scanning project ${project.id}:`, err)
                // Continue to next project
            }
        }

    } catch (error) {
        console.error('Error scanning for orphans:', error)
        throw error
    }

    return orphans
}

// Calculate total size of a folder (recursive)
async function calculateFolderSize(path: string): Promise<number> {
    let totalSize = 0
    const folderRef = ref(storage, path)

    try {
        const res = await listAll(folderRef)

        // Add size of files in this folder
        for (const itemRef of res.items) {
            const metadata = await getMetadata(itemRef)
            totalSize += metadata.size
        }

        // Recurse for subfolders
        for (const prefixRef of res.prefixes) {
            totalSize += await calculateFolderSize(prefixRef.fullPath)
        }
    } catch (err) {
        console.warn(`Error calculating size for ${path}:`, err)
    }

    return totalSize
}

// Delete an orphan item (folder or file) is slightly complex because 
// Firebase Storage API doesn't support "delete folder". 
// We must list and delete all files recursively.
export async function deleteOrphan(item: OrphanedItem): Promise<void> {
    await deleteFolderRecursively(item.path)
}

async function deleteFolderRecursively(path: string): Promise<void> {
    const folderRef = ref(storage, path)

    const res = await listAll(folderRef)

    // Delete files
    const deletePromises = res.items.map(itemRef => deleteObject(itemRef))
    await Promise.all(deletePromises)

    // Recurse for subfolders
    const folderPromises = res.prefixes.map(prefixRef => deleteFolderRecursively(prefixRef.fullPath))
    await Promise.all(folderPromises)
}
