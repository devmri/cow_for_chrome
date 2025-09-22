function handleOnboardingButtonClick(btn: Element): void {
  const prompt = btn.getAttribute('data-task-prompt')
  if (!prompt) return
  chrome.runtime.sendMessage({ type: 'open_side_panel', prompt })
}

document.body.addEventListener('click', (ev) => {
  const target = ev.target as Element | null
  if (!target?.closest) return
  const btn = target.closest('#claude-onboarding-button')
  if (btn) handleOnboardingButtonClick(btn)
})

