import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TaasClient, TelemetryEvent } from '@taas/domain-sdk';

function ObsOverlay() {
  const [telemetry, setTelemetry] = useState<TelemetryEvent | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId') || 'session_demo';
    const baseUrl = window.location.origin.replace('4175', '8080'); // Fallback dev logic

    const client = new TaasClient({ baseUrl });
    const cancel = client.subscribeSession(sessionId, (event) => {
        setTelemetry(event);
        if (event.status === 'ack' || event.status === 'executing') {
            setActive(true);
            setTimeout(() => setActive(false), 1000);
        }
    });

    return () => cancel();
  }, []);

  const intensity = active ? 1.0 : 0.0;

  return (
    <div style={{ 
        width: '300px', 
        height: '100px', 
        background: 'rgba(0,0,0,0.5)', 
        color: 'white', 
        padding: '20px',
        borderRadius: '15px',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        border: active ? '3px solid #b14d2a' : '3px solid transparent',
        transition: 'border 0.2s ease'
    }}>
      <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>DEVICE STATUS</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
        {telemetry?.device_state || 'CONNECTING...'}
      </div>
      <div style={{ 
          width: '100%', 
          height: '10px', 
          background: '#333', 
          marginTop: '15px',
          borderRadius: '5px',
          overflow: 'hidden'
      }}>
        <div style={{ 
            width: `${intensity * 100}%`, 
            height: '100%', 
            background: '#b14d2a',
            transition: 'width 0.1s ease'
        }} />
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ObsOverlay />);
}
