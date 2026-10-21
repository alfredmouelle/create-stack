import { renderApp } from 'rasengan/client'
import AppRouter from './app/app.router'
import App from './main'

void renderApp(App, AppRouter, { reactStrictMode: true })
