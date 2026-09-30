'use client'

import { useRef, useState } from 'react'
import { questionnaireAnswers, type Questionnaire } from '../../../harness/plugins/webchat/questions'

export function ChatQuestionnaire({ value, submitted, collapsed = false, onSubmit, displayText = s => s }: {
  value: Questionnaire
  submitted: boolean
  collapsed?: boolean
  onSubmit?: (text: string) => Promise<boolean>
  displayText?: (text: string) => string
}) {
  const [step, setStep] = useState(0)
  const [choices, setChoices] = useState<number[]>([])
  const [ticked, setTicked] = useState<number[][]>([])
  const [custom, setCustom] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const sending = useRef(false)
  const { questions } = value
  // A multi-select answer lists every ticked choice, then any free text, joined by "; ".
  const answers = questions.map((q, i) => q.multiSelect
    ? [...q.options.filter((_, j) => ticked[i]?.includes(j)), (custom[i] || '').trim()].filter(Boolean).join('; ')
    : choices[i] === q.options.length ? (custom[i] || '').trim() : q.options[choices[i]] || '')
  const review = step === questions.length
  const q = questions[step]
  const button = 'min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere] min-h-11 rounded-lg border border-lps-hair px-3 py-2 text-left hover:bg-muted disabled:opacity-50'

  function choose(index: number) {
    setChoices(prev => { const next = [...prev]; next[step] = index; return next })
    setCustom(prev => { const next = [...prev]; next[step] = ''; return next })
    setStep(step + 1)
  }

  function toggle(index: number) {
    setTicked(prev => { const next = [...prev], now = next[step] || []; next[step] = now.includes(index) ? now.filter(j => j !== index) : [...now, index]; return next })
  }

  async function submit() {
    if (!onSubmit || sending.current || submitted || done) return
    sending.current = true
    setBusy(true)
    setError('')
    try {
      if (await onSubmit(questionnaireAnswers(value, answers))) setDone(true)
      else setError('Answers could not be sent. Please try again.')
    } catch { setError('Answers could not be sent. Please try again.') }
    finally { sending.current = false; setBusy(false) }
  }

  return <section aria-label={displayText(value.title)} className="flex w-full min-w-0 max-w-full flex-col gap-3 [overflow-wrap:anywhere]">
    <h3 className="font-semibold">{displayText(value.title)}</h3>
    {collapsed ? questions.map((question, i) => <p key={i} className="whitespace-pre-wrap">{displayText(question.question)}</p>) : submitted || done ? <p role="status">Answers submitted.</p> : <>
      <p className="text-sm text-muted-foreground" aria-live="polite">{review ? 'Review your answers' : `Question ${step + 1} of ${questions.length}`}</p>
      {review ? <ol className="flex min-w-0 max-w-full flex-col gap-3">
        {questions.map((question, i) => <li key={i} className="min-w-0 max-w-full">
          <p className="font-medium">{i + 1}. {displayText(question.question)}</p>
          <p className="whitespace-pre-wrap">{displayText(answers[i])}</p>
          <button type="button" className="min-h-11 text-sm underline" disabled={busy} onClick={() => setStep(i)}>Edit answer {i + 1}</button>
        </li>)}
      </ol> : <fieldset className="flex w-full min-w-0 max-w-full flex-col gap-2">
        <legend className="mb-2 max-w-full whitespace-normal font-medium">{displayText(q.question)}</legend>
        {q.multiSelect ? <>
          <p className="text-sm text-muted-foreground">Select all that apply</p>
          {q.options.map((option, i) => { const on = !!ticked[step]?.includes(i); return <button type="button" role="checkbox" key={`${step}-${i}`} aria-checked={on} onClick={() => toggle(i)} className={`${button} flex w-full cursor-pointer items-start gap-2 ${on ? 'bg-muted' : ''}`}>
            <span aria-hidden="true" className={`mt-1 size-3 shrink-0 rounded-sm border ${on ? 'border-primary bg-primary' : 'border-current'}`} />
            <span className="min-w-0 flex-1">{displayText(option)}</span>
          </button> })}
        </> : q.options.map((option, i) => <button type="button" key={`${step}-${i}`} aria-pressed={choices[step] === i} onClick={() => choose(i)} className={`${button} flex w-full cursor-pointer items-start gap-2 ${choices[step] === i ? 'bg-muted' : ''}`}>
          <span aria-hidden="true" className={`mt-1 size-3 shrink-0 rounded-full border ${choices[step] === i ? 'border-primary bg-primary' : 'border-current'}`} />
          <span className="min-w-0 flex-1">{displayText(option)}</span>
        </button>)}
        {<textarea aria-label="Something else" placeholder="Something else" maxLength={4000} rows={3} className="w-full min-w-0 max-w-full resize-y rounded-lg border border-lps-hair p-2" value={custom[step] || ''} onChange={e => { const text = e.target.value; if (!q.multiSelect) setChoices(prev => { const next = [...prev]; next[step] = q.options.length; return next }); setCustom(prev => { const next = [...prev]; next[step] = text; return next }) }} />}
      </fieldset>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex min-w-0 flex-wrap gap-2">
        {step > 0 && <button type="button" className={button} disabled={busy} onClick={() => setStep(step - 1)}>Previous</button>}
        {review ? <button type="button" className={button} disabled={busy || !onSubmit || answers.some(a => !a)} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit answers'}</button>
          : <button type="button" className={button} disabled={q.multiSelect ? !answers[step] : choices[step] !== q.options.length || !answers[step]} onClick={() => setStep(step + 1)}>Save answer</button>}
      </div>
    </>}
  </section>
}
