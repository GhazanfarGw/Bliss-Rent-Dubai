import { describe, it, expect } from 'vitest'
import { getComplaintNotificationContent } from './complaintNotificationContent.ts'

describe('getComplaintNotificationContent', () => {
  it('returns EN content', () => {
    const content = getComplaintNotificationContent('en')
    expect(content.subject).toContain('Contact Us')
    expect(content.priority).toBe('attention')
    expect(content.requiredAction).toBeTruthy()
  })

  it('returns AR content, distinct from EN', () => {
    const en = getComplaintNotificationContent('en')
    const ar = getComplaintNotificationContent('ar')
    expect(ar.subject).not.toBe(en.subject)
    expect(ar.alertType).not.toBe(en.alertType)
    expect(ar.requiredAction).not.toBe(en.requiredAction)
  })

  it('always sets a required action — a complaint always needs a human response', () => {
    expect(getComplaintNotificationContent('en').requiredAction.length).toBeGreaterThan(0)
    expect(getComplaintNotificationContent('ar').requiredAction.length).toBeGreaterThan(0)
  })
})
