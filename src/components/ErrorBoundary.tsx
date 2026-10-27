import { Component, ReactNode } from 'react';

/** A crash in one screen shows a recovery card instead of a blank white app. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 space-y-3">
        <div className="font-semibold">Something went wrong on this screen.</div>
        <div className="text-xs text-red-800/80 break-words">{this.state.error.message}</div>
        <button className="h-10 px-4 rounded-xl bg-red-700 text-white font-medium" onClick={() => { window.location.hash = '#/'; this.setState({ error: null }); }}>
          Go to home
        </button>
      </div>
    );
  }
}
