import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorPage } from './ErrorPage'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

/**
 * Top-level render boundary. Unexpected UI crashes show the 500-style screen.
 * Stack traces are logged only — never rendered in production UI.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage status={500} />
    }
    return this.props.children
  }
}
