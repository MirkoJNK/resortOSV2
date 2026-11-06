import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/tokens.css'
import './styles/app.css'
import './styles/typography.css'
import './styles/components.css'
import './styles/responsive.css'
import './styles/motion.css'
import './styles/support.css'
import './styles/sidebar-story.css'
import './styles/support-motion.css'
import './styles/navigation-cleanup.css'

const mount = document.getElementById('root')
if (!mount) throw new Error('Missing application root')
createRoot(mount).render(<React.StrictMode><App /></React.StrictMode>)

import './styles/light-sidebar-v058.css'
import './styles/layout-integration-v062.css'
