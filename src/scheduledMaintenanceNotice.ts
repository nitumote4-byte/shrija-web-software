/**
 * Scheduled-maintenance notice rules.
 * Authoritative copy lives under server/ so the Railway API can resolve it.
 * The browser imports this same module for the bell, login notice, and banner.
 */
export * from '../server/src/scheduledMaintenanceNotice.ts'
