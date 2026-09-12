import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { store } from './app/store.js'
import { Provider } from 'react-redux'
import { ClerkProvider } from '@clerk/react'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'


const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const root = document.getElementById('root')

if (!PUBLISHABLE_KEY) {
    root.innerHTML = `
        <main style="font-family: sans-serif; max-width: 560px; margin: 20vh auto; padding: 24px; text-align: center; color: #18181b">
            <h1>Deployment configuration is incomplete</h1>
            <p>Set VITE_CLERK_PUBLISHABLE_KEY in the Vercel project environment variables, then redeploy.</p>
        </main>
    `
} else {
    createRoot(root).render(
        <BrowserRouter>
            <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
                <Provider store={store}>
                    <AppErrorBoundary>
                        <App />
                    </AppErrorBoundary>
                </Provider>
            </ClerkProvider>
        </BrowserRouter>,
    )
}