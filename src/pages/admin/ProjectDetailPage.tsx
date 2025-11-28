import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useProjectStore } from '@/stores/projects'

export default function ProjectDetailPage() {
  const { projectId } = useParams()
  const { projects } = useProjectStore()
  const project = projects.find(p => p.id === projectId)

  useEffect(() => {
    // In a full implementation, you'd subscribe to files here
  }, [projectId])

  if (!project) {
    return <div className="text-muted-foreground">Đang tải dự án...</div>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{project.name}</h1>
      <p className="text-sm text-muted-foreground">Trạng thái: {project.status}</p>

      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Files</h2>
        <p className="text-muted-foreground">Chưa có file. Tính năng upload sẽ được thêm ở bước tiếp theo.</p>
      </div>
    </div>
  )
}
