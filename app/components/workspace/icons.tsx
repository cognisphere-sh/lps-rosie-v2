// Icon set lifted from the Supplier Workspace design so the rail and table
// chrome match it exactly rather than approximating with a generic set.

const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

type P = { className?: string; size?: number }
const box = ({ size }: P) => (size ? { width: size, height: size } : { width: '100%', height: '100%' })

export const SuppliersIcon = (p: P) => (
  <svg {...stroke} {...box(p)} className={p.className}>
    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h2M9 13h2M9 17h2M15 9h2M15 13h2M15 17h2" />
  </svg>
)

export const InventoryIcon = (p: P) => (
  <svg {...stroke} {...box(p)} className={p.className}>
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
)

export const RequestsIcon = (p: P) => (
  <svg {...stroke} {...box(p)} className={p.className}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M9 3v3h6V3M8 11h8M8 15h5" />
  </svg>
)

export const SettingsIcon = (p: P) => (
  <svg {...stroke} {...box(p)} className={p.className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
  </svg>
)

export const SunIcon = (p: P) => (
  <svg {...stroke} {...box(p)} className={p.className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

export const MoonIcon = (p: P) => (
  <svg {...stroke} {...box(p)} className={p.className}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
)

export const SearchIcon = (p: P) => (
  <svg {...stroke} strokeWidth={2} {...box(p)} className={p.className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
)

export const SparkIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...box(p)} className={p.className}>
    <path d="M12 2.5 13.9 9 20 11l-6.1 2L12 19.5 10.1 13 4 11l6.1-2Z" />
  </svg>
)

export const ChevronLeft = (p: P) => (
  <svg {...stroke} strokeWidth={2} {...box(p)} className={p.className}><path d="m15 6-6 6 6 6" /></svg>
)
export const ChevronRight = (p: P) => (
  <svg {...stroke} strokeWidth={2} {...box(p)} className={p.className}><path d="m9 6 6 6-6 6" /></svg>
)
export const ChevronDown = (p: P) => (
  <svg {...stroke} strokeWidth={2} {...box(p)} className={p.className}><path d="m6 9 6 6 6-6" /></svg>
)

export const SortNone = (p: P) => (
  <svg {...stroke} strokeWidth={2} {...box(p)} className={p.className}><path d="m7 15 3 3 3-3M7 9l3-3 3 3" /></svg>
)
export const SortAsc = (p: P) => (
  <svg {...stroke} strokeWidth={2.2} {...box(p)} className={p.className}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
)
export const SortDesc = (p: P) => (
  <svg {...stroke} strokeWidth={2.2} {...box(p)} className={p.className}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
)

export const ColumnsIcon = (p: P) => (
  <svg {...stroke} strokeWidth={1.9} {...box(p)} className={p.className}>
    <path d="M4 3h16v18H4z" /><path d="M9.5 3v18M14.5 3v18" />
  </svg>
)

export const EyeOffIcon = (p: P) => (
  <svg {...stroke} {...box(p)} className={p.className}>
    <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M6.6 6.6A18.4 18.4 0 0 0 2 12s3 8 10 8a9.3 9.3 0 0 0 5.4-1.6" />
    <path d="m2 2 20 20" /><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2" />
  </svg>
)

export const TrashIcon = (p: P) => (
  <svg {...stroke} {...box(p)} className={p.className}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
  </svg>
)

export const PencilIcon = (p: P) => (
  <svg {...stroke} strokeWidth={1.9} {...box(p)} className={p.className}>
    <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
)

export const CheckIcon = (p: P) => (
  <svg {...stroke} strokeWidth={3} {...box(p)} className={p.className}><path d="M20 6 9 17l-5-5" /></svg>
)
export const CloseIcon = (p: P) => (
  <svg {...stroke} strokeWidth={3} {...box(p)} className={p.className}><path d="M18 6 6 18M6 6l12 12" /></svg>
)

export const FileIcon = (p: P) => (
  <svg {...stroke} {...box(p)} className={p.className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" />
  </svg>
)

export const UploadIcon = (p: P) => (
  <svg {...stroke} {...box(p)} className={p.className}><path d="M4 16v3h16v-3M12 4v11M8 8l4-4 4 4" /></svg>
)

export const LogoutIcon = (p: P) => (
  <svg {...stroke} strokeWidth={1.9} {...box(p)} className={p.className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
  </svg>
)
