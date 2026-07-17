import { Component, type ReactNode } from 'react'

interface Props {
  readonly children: ReactNode
  readonly fallback: ReactNode
}

interface State {
  readonly hasError: boolean
}

/**
 * ErrorBoundary — renders `fallback` instead of letting a descendant's render-time
 * throw unmount the whole React tree.
 *
 * Required around `@hakit`'s `useWeather`: on a forecast-subscription failure it
 * stores the error and re-throws it DURING render. With no boundary that throw
 * reaches the React root and blanks the entire kiosk until a manual reload — a
 * direct AD-6 violation ("jamais de blanc") on an unattended wall display.
 *
 * Recovery is by remount: navigating away and back to the page mounts a fresh
 * boundary (`hasError: false`) and the subscription is retried.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
