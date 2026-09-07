export function FinderStepper({ step = 1 }: { step?: number }) {
  const steps = ['Tell us about you', 'Your scholarship matches', 'Get scholarship ebook']
  return <section className="stepper-band"><ol className="finder-stepper" aria-label="Scholarship Finder progress">{steps.map((label, index) => <li className={index + 1 <= step ? 'complete' : ''} key={label}><span className="step-dot">{index + 1 <= step ? '✓' : ''}</span><span>{label}</span>{index < steps.length - 1 && <i aria-hidden="true" />}</li>)}</ol><p>Step {step} of 3– {step === 1 ? 'enter your information' : 'review your scholarship matches'}</p></section>
}
