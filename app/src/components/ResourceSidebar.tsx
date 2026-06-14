import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SidebarKind {
  value: string
  icon: LucideIcon
}

interface ResourceSidebarProps {
  kinds: SidebarKind[]
  active: string
  onSelect: (value: string) => void
  collapsed: boolean
  onToggle: () => void
}

export default function ResourceSidebar({
  kinds,
  active,
  onSelect,
  collapsed,
  onToggle,
}: ResourceSidebarProps) {
  return (
    <nav
      className={cn(
        'flex shrink-0 flex-col gap-1 border-r bg-card/30 py-2 transition-[width] duration-200',
        collapsed ? 'w-12' : 'w-48',
      )}
    >
      <button
        onClick={onToggle}
        title={collapsed ? 'Expand' : 'Collapse'}
        className="mb-1 flex h-7 items-center justify-end px-3 text-muted-foreground hover:text-foreground"
      >
        {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
      </button>

      {!collapsed && (
        <div className="px-3 pb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Workloads
        </div>
      )}

      <ul className="flex flex-col gap-0.5 px-2">
        {kinds.map((kind) => {
          const Icon = kind.icon
          const isActive = kind.value === active
          return (
            <li key={kind.value}>
              <button
                onClick={() => onSelect(kind.value)}
                title={kind.value}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  collapsed && 'justify-center',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span>{kind.value}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
