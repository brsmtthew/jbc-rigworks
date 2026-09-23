import { Component, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="recovery-screen" role="alert"><TriangleAlert size={36} /><h1>We could not open this workspace.</h1><p>Your saved records have not been deleted. Reload to try again, or return to the dashboard.</p><div><button className="primary-button" onClick={() => window.location.reload()}>Reload page</button><a className="secondary-button" href="/">Return to dashboard</a></div></main>
    return this.props.children
  }
}
