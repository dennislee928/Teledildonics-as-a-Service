use companion_core::device::MockDeviceBackend;
use companion_core::model::ArmedSession;
use companion_core::relay::MockRelayTransport;
use companion_core::runtime::CompanionRuntime;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

pub struct CompanionState {
    runtime: Mutex<CompanionRuntime<MockRelayTransport, MockDeviceBackend>>,
}

impl CompanionState {
    pub fn new() -> Self {
        Self {
            runtime: Mutex::new(CompanionRuntime::new(
                MockRelayTransport::new("cloudflare-realtime"),
                MockDeviceBackend::with_device("device_demo"),
            )),
        }
    }
}

#[derive(Serialize)]
pub struct SessionView {
    relay_mode: &'static str,
}

mod commands {
    use super::{ArmedSession, CompanionState, SessionView, State};

    #[tauri::command]
    pub fn bootstrap_runtime(state: State<'_, CompanionState>) -> SessionView {
        let mut runtime = state.runtime.lock().expect("poisoned lock");
        runtime.arm_session(ArmedSession {
            session_id: "session_demo".into(),
            device_id: "device_demo".into(),
            session_key: [7u8; 32],
            max_intensity: 88,
            max_duration_ms: 12_000,
        });
        SessionView {
            relay_mode: runtime.relay_mode(),
        }
    }

    #[tauri::command]
    pub fn panic_stop(state: State<'_, CompanionState>) -> Result<String, String> {
        let mut runtime = state.runtime.lock().expect("poisoned lock");
        runtime
            .panic_stop("operator panic stop")
            .map(|event| event.status)
            .map_err(|error| error.to_string())
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(CompanionState::new())
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap_runtime,
            commands::panic_stop
        ])
        .run(tauri::generate_context!())
        .expect("failed to run companion shell");
}
