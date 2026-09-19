import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Clock,
  CloudOff,
  FileQuestion,
  Lock,
  RefreshCw,
  ServerCrash,
  ShieldOff,
  Timer,
  Unplug,
} from 'lucide-react'

export type HttpErrorActionId = 'dashboard' | 'back' | 'login' | 'retry' | 'reload'

export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503 | 504

export type HttpErrorConfig = {
  status: HttpErrorStatus
  title: string
  description: string
  /** Short safe message suitable for toasts / ApiRequestError fallbacks. */
  safeMessage: string
  icon: LucideIcon
  primaryAction: HttpErrorActionId
  secondaryAction?: HttpErrorActionId
}

export const HTTP_ERROR_STATUSES: readonly HttpErrorStatus[] = [
  400, 401, 403, 404, 409, 429, 500, 502, 503, 504,
] as const

export const HTTP_ERROR_CONFIG: Record<HttpErrorStatus, HttpErrorConfig> = {
  400: {
    status: 400,
    title: 'Bad Request',
    description: 'The request could not be understood. Please check your input and try again.',
    safeMessage: 'The request could not be processed. Please check your input and try again.',
    icon: AlertTriangle,
    primaryAction: 'back',
    secondaryAction: 'dashboard',
  },
  401: {
    status: 401,
    title: 'Session Required',
    description: 'You need to sign in to continue. Your session may have expired.',
    safeMessage: 'Your session has expired or is invalid. Please sign in again.',
    icon: Lock,
    primaryAction: 'login',
  },
  403: {
    status: 403,
    title: 'Access Denied',
    description: "You don't have permission to access this page.",
    safeMessage: 'You do not have permission to perform this action.',
    icon: ShieldOff,
    primaryAction: 'back',
    secondaryAction: 'dashboard',
  },
  404: {
    status: 404,
    title: 'Page Not Found',
    description: "The page you're looking for doesn't exist or may have been moved.",
    safeMessage: 'The requested page or resource was not found.',
    icon: FileQuestion,
    primaryAction: 'dashboard',
    secondaryAction: 'back',
  },
  409: {
    status: 409,
    title: 'Data Conflict',
    description: 'This data was updated elsewhere. Refresh and try again.',
    safeMessage: 'This data was updated elsewhere. Please refresh and try again.',
    icon: RefreshCw,
    primaryAction: 'reload',
    secondaryAction: 'back',
  },
  429: {
    status: 429,
    title: 'Too Many Requests',
    description: 'Too many requests were sent. Please wait a moment and try again.',
    safeMessage: 'Too many requests. Please wait a moment and try again.',
    icon: Timer,
    primaryAction: 'retry',
  },
  500: {
    status: 500,
    title: 'Something Went Wrong',
    description: 'An unexpected server error occurred. Please try again.',
    safeMessage: 'An unexpected error occurred. Please try again.',
    icon: ServerCrash,
    primaryAction: 'retry',
    secondaryAction: 'dashboard',
  },
  502: {
    status: 502,
    title: 'Bad Gateway',
    description: 'Shrija could not reach a required service. Please try again shortly.',
    safeMessage: 'A required service is temporarily unreachable. Please try again shortly.',
    icon: Unplug,
    primaryAction: 'retry',
    secondaryAction: 'dashboard',
  },
  503: {
    status: 503,
    title: 'Service Temporarily Unavailable',
    description: 'Shrija is temporarily unavailable. Please try again shortly.',
    safeMessage: 'Shrija is temporarily unavailable. Please try again shortly.',
    icon: CloudOff,
    primaryAction: 'retry',
    secondaryAction: 'dashboard',
  },
  504: {
    status: 504,
    title: 'Gateway Timeout',
    description: 'The request took too long to complete. Please try again.',
    safeMessage: 'The request timed out. Please try again.',
    icon: Clock,
    primaryAction: 'retry',
    secondaryAction: 'dashboard',
  },
}

/** Map any HTTP status to a known error-page status (unknown → 500). */
export function resolveHttpErrorStatus(status: number): HttpErrorStatus {
  if ((HTTP_ERROR_STATUSES as readonly number[]).includes(status)) {
    return status as HttpErrorStatus
  }
  return 500
}

export function getHttpErrorConfig(status: number): HttpErrorConfig {
  return HTTP_ERROR_CONFIG[resolveHttpErrorStatus(status)]
}

export function getActionLabel(action: HttpErrorActionId): string {
  switch (action) {
    case 'dashboard':
      return 'Go to Dashboard'
    case 'back':
      return 'Go Back'
    case 'login':
      return 'Login'
    case 'retry':
      return 'Try Again'
    case 'reload':
      return 'Refresh'
    default:
      return 'Continue'
  }
}
