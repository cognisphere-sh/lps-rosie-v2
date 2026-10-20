'use client'

import { AREditorBody, AREditorFooter, useAREditor, useARNarrow } from '@/components/workspace/ar-editor'

/**
 * The open supplier tab on a job card: the AR itself, edited in place in the
 * portal's drawing. Its own module so job-request.tsx can load it lazily.
 */
export function SupplierARPanel({ arId }: { arId: number }) {
  const editor = useAREditor(arId)
  const narrow = useARNarrow()
  return (
    <div role="tabpanel" data-supplier-ar-panel={arId} className="space-y-2.5 border-t border-border bg-lps-tint p-2.5 sm:p-3">
      <AREditorBody editor={editor} portal mobile={narrow} summaryCard={false} />
      <AREditorFooter editor={editor} portal className="rounded-xl border" />
    </div>
  )
}
