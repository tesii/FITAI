import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import ProgressPhotoUpload from '../components/ProgressPhotoUpload'
import { initVideoCall, setupControls } from '../main.js'
import { useEffect, useRef } from 'react'

function Dashboard({ user }) {
  const [workouts, setWorkouts] = useState([])

  useEffect(() => {
    fetchWorkouts()
  }, [])

  async function fetchWorkouts() {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', user.id)

    if (error) console.error(error)
    else setWorkouts(data)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>

      <ProgressPhotoUpload userId={user.id} />

      <div>
        <h2>Your Workouts</h2>
        {workouts.map(w => (
          <div key={w.id} style={{ marginBottom: '12px', padding: '10px', background: '#161b22', borderRadius: '12px' }}>
            <h3>{w.title}</h3>
            <p>{w.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard