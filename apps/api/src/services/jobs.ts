import type { CronRun, Me } from '@meridian/shared'
import { auditLogRepo, serverStateRepo } from '../repositories'
import { bookingService } from './bookings'
import { campaignService } from './campaigns'
import { pushService } from './push'
import { AppError } from '../http/errors'

// The work that happens on a clock rather than because someone did something. The hosting calls
// these once a day (see the `crons` block in vercel.json); an admin can also press Run now on the
// Server page, which is how they get run at all until the scheduler is set up.
//
// Each run is recorded, so the Server page can say plainly whether anything is calling us.

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const JOBS: Record<string, () => Promise<{ result: Record<string, unknown>; summary: string }>> = {
  async daily() {
    const [messages, schedule, pushed] = await Promise.all([
      bookingService.sendDailyMessages(),
      campaignService.refreshSchedule(),
      pushService.sendDueCampaigns(),
    ])
    // Only what actually happened is worth reporting: a run that did nothing should say so plainly
    // rather than listing five zeroes.
    const parts = [
      messages.reminders && plural(messages.reminders, 'check-in reminder'),
      messages.invites && plural(messages.invites, 'review invitation'),
      schedule.started && `${schedule.started} ${schedule.started === 1 ? 'offer' : 'offers'} started`,
      schedule.finished && `${schedule.finished} ${schedule.finished === 1 ? 'offer' : 'offers'} finished`,
      pushed.sent && plural(pushed.sent, 'push notification'),
      pushed.failed && `${pushed.failed} failed to send`,
    ].filter(Boolean)
    return {
      result: { ...messages, campaigns: { ...schedule, ...pushed } },
      summary: parts.length ? parts.join(', ') : 'nothing was due',
    }
  },

  async expire() {
    const expired = await bookingService.expireStale()
    return { result: { expired }, summary: expired ? `${plural(expired, 'booking')} released` : 'nothing was due' }
  },
}

/**
 * Runs one job and remembers that it ran. A job that throws is recorded as failed and the error is
 * passed on, so the scheduler sees a non-200 and the page shows what went wrong.
 */
export async function runJob(name: string, by: CronRun['by'], admin?: Me) {
  const job = JOBS[name]
  if (!job) throw new AppError(404, 'No such job.')
  try {
    const { result, summary } = await job()
    const run = await serverStateRepo.recordJobRun(name, { ok: true, summary, by })
    if (admin) await auditLogRepo.record(admin, 'server.job.run', 'server', name, { summary })
    return { run, result }
  } catch (err) {
    const message = (err as Error).message.slice(0, 200)
    await serverStateRepo.recordJobRun(name, { ok: false, summary: message, by })
    throw err
  }
}
