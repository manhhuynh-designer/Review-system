import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { File as FileType } from '@/types'

export function useProjectThumbnail(projectId: string) {
  const [thumbnailData, setThumbnailData] = useState<{ url: string; type: 'image' | 'video' } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) {
      setLoading(false)
      return
    }

    async function fetchLatestImage() {
      try {
        setLoading(true)

        // Fetch all files from the project (no index required)
        const filesRef = collection(db, 'projects', projectId, 'files')
        const snapshot = await getDocs(filesRef)

        if (!snapshot.empty) {
          // Filter and sort on client side
          const files = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as FileType))
            .filter(file => ['image', 'sequence', 'video', 'model'].includes(file.type))
            .sort((a, b) => {
              const aTime = a.createdAt?.toMillis?.() || 0
              const bTime = b.createdAt?.toMillis?.() || 0
              return bTime - aTime
            })

          if (files.length > 0) {
            const latestFile = files[0]
            const currentVersionData = latestFile.versions?.[latestFile.currentVersion - 1]

            if (currentVersionData) {
              // If there's a specific thumbnail (e.g. for 3D models or generated), use it as image
              if (currentVersionData.thumbnailUrl) {
                setThumbnailData({ url: currentVersionData.thumbnailUrl, type: 'image' })
              }
              // For videos, use the video URL
              else if (latestFile.type === 'video' && currentVersionData.url) {
                setThumbnailData({ url: currentVersionData.url, type: 'video' })
              }
              // For images/sequences, use the URL
              else if (currentVersionData.url) {
                setThumbnailData({ url: currentVersionData.url, type: 'image' })
              } else {
                setThumbnailData(null)
              }
            } else {
              setThumbnailData(null)
            }
          } else {
            setThumbnailData(null)
          }
        } else {
          setThumbnailData(null)
        }
      } catch (error: any) {
        console.error('Error fetching thumbnail:', error)
        setThumbnailData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchLatestImage()
  }, [projectId])

  return { thumbnailData, loading }
}
