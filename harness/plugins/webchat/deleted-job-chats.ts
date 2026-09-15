/** Apply durable job-chat deletions. Busy harness turns are retried next pass. */
export async function purgeDeletedJobChats({ db, agent, deleted, forget, reset }: {
  db: any
  agent: string
  deleted: Set<string>
  forget: (threadId: string) => void
  reset: (threadId: string) => void | Promise<void>
}): Promise<void> {
  if (agent !== 'rosie') return
  let offset = 0
  while (true) {
    const { data, error } = await db.from('deleted_job_threads').select('thread_id, purged_at')
      .eq('agent', agent).order('thread_id').range(offset, offset + 999)
    if (error) throw new Error(`deleted job chats: ${error.message}`)
    for (const row of data ?? []) {
      deleted.add(row.thread_id)
      forget(row.thread_id)
      if (row.purged_at) continue
      try {
        await reset(row.thread_id)
      } catch {
        // resetThread refuses an in-flight turn. The tombstone already blocks
        // transcript writes; retain the durable cleanup request for retry.
        continue
      }
      const { error: updateError } = await db.from('deleted_job_threads')
        .update({ purged_at: new Date().toISOString() }).eq('agent', agent).eq('thread_id', row.thread_id)
      if (updateError) throw new Error(`deleted job chat cleanup: ${updateError.message}`)
    }
    if ((data?.length ?? 0) < 1000) return
    offset += 1000
  }
}
