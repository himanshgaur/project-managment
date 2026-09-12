import { Component } from "react";

class AppErrorBoundary extends Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-zinc-900">
                <div className="max-w-lg">
                    <h1 className="text-2xl font-semibold">Something went wrong</h1>
                    <p className="mt-3 text-zinc-600">
                        The page could not be rendered. Refresh the page and try again.
                    </p>
                    <p className="mt-2 text-sm text-red-600">
                        {this.state.error.message}
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-5 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                        Refresh page
                    </button>
                </div>
            </div>
        );
    }
}

export default AppErrorBoundary;
