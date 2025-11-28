import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/stores/projects'
import { useNavigate } from 'react-router-dom'
import type { Project } from '@/types'

export function ProjectCard({ project }: { project: Project }) {
  const updateProject = useProjectStore(s => s.updateProject)
  const navigate = useNavigate()

  const created = project.createdAt?.toDate ? project.createdAt.toDate() : new Date()

  return (
    <div className="rounded-lg border p-4 shadow-sm flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">{project.name}</h3>
        <p className="text-sm text-muted-foreground">
          Tạo lúc {format(created, 'dd/MM/yyyy HH:mm')} • Trạng thái: {project.status}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => navigate(`/app/projects/${project.id}`)}>Mở</Button>
        {project.status === 'active' ? (
          <Button variant="outline" onClick={() => updateProject(project.id, { status: 'archived' })}>Archive</Button>
        ) : (
          <Button variant="outline" onClick={() => updateProject(project.id, { status: 'active' })}>Unarchive</Button>
        )}
      </div>
    </div>
  )
}
