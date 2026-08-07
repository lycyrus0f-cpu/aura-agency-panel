window.AURA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAN0vErEN2uXfngSI4I3i0ajhpAIkTv3ys",
  authDomain: "aura-agency-panel.firebaseapp.com",
  projectId: "aura-agency-panel",
  storageBucket: "aura-agency-panel.firebasestorage.app",
  messagingSenderId: "511207409197",
  appId: "1:511207409197:web:5580c39335511b02e95aa4",
  measurementId: "G-BERS574BFK"
};

/* V6 Live is loaded after the existing V4/V5 application has finished booting. */
window.addEventListener('load', () => {
  setTimeout(() => {
    if (!document.getElementById('aura-v6-live-loader')) {
      const s = document.createElement('script');
      s.id = 'aura-v6-live-loader';
      s.src = 'v6-live.js?v=6.0.1';
      document.body.appendChild(s);
    }
  }, 1800);

  setTimeout(() => {
    if (document.getElementById('aura-v6-private-fix-loader')) return;
    const s = document.createElement('script');
    s.id = 'aura-v6-private-fix-loader';
    s.src = 'v6-private-fix.js?v=6.0.1';
    document.body.appendChild(s);
  }, 2600);

  setTimeout(() => {
    if (document.getElementById('aura-v6-ops-fix-loader')) return;
    const s = document.createElement('script');
    s.id = 'aura-v6-ops-fix-loader';
    s.src = 'v6-ops-fix.js?v=6.0.2';
    document.body.appendChild(s);
  }, 3200);
});
