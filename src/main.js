// src/main.js
import { supabase } from './lib/supabaseClient.js'  // make sure this path is correct

document.addEventListener('DOMContentLoaded', async () => {
  console.log('JS is working!');

  const webcamEl = document.getElementById('webcamVideo');
  const remoteEl = document.getElementById('remoteVideo');
  const micBtn = document.getElementById('toggleMic');
  const videoBtn = document.getElementById('toggleVideo');

  // --- Init local video ---
  try {
    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    webcamEl.srcObject = localStream;
    webcamEl.play();
  } catch (err) {
    console.error('Error accessing webcam:', err);
  }

  // --- Setup toggle controls ---
  let videoEnabled = true;
  let micEnabled = true;

  videoBtn.addEventListener('click', () => {
    if (!webcamEl.srcObject) return;
    videoEnabled = !videoEnabled;
    webcamEl.srcObject.getVideoTracks()[0].enabled = videoEnabled;
    videoBtn.classList.toggle('active', videoEnabled);
  });

  micBtn.addEventListener('click', () => {
    if (!webcamEl.srcObject) return;
    micEnabled = !micEnabled;
    webcamEl.srcObject.getAudioTracks()[0].enabled = micEnabled;
    micBtn.classList.toggle('active', micEnabled);
  });

  // --- Upload progress photo example ---
  const progressInput = document.getElementById('progressPhotoInput'); // add this input in HTML
  const progressPreview = document.getElementById('progressPhotoPreview'); // add this img in HTML
  const userId = '123'; // replace with actual logged-in user ID

  if (progressInput && progressPreview) {
    progressInput.addEventListener('change', async () => {
      const file = progressInput.files[0];
      if (!file) return alert('Choose a file first!');
      const fileName = `user-${userId}/${file.name}`;

      const { data, error } = await supabase.storage
        .from('progress-photos')
        .upload(fileName, file, { upsert: true });

      if (error) return console.error(error);

      const { publicURL } = supabase.storage.from('progress-photos').getPublicUrl(fileName);
      progressPreview.src = publicURL;

      const { error: dbError } = await supabase.from('progress_photos').insert([{ user_id: userId, photo_url: publicURL }]);
      if (dbError) console.error(dbError);
    });
  }

});