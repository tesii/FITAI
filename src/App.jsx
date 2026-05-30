import React from 'react'
import Dashboard from './pages/Dashboard'

function App() {
  const user = { id: 'example-uuid', name: 'Patience' } // Replace with Auth later
  return <Dashboard user={user} />
}

export default App