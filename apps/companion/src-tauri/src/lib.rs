use base64::Engine;
use companion_core::device::MockDeviceBackend;
use companion_core::model::{ArmedSession, TelemetryEvent};
use companion_core::relay::MockRelayTransport;
use companion_core::runtime::CompanionRuntime;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

const BASE64: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;

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
    session_id: String,
    device_id: String,
    relay_mode: &'static str,
    armed: bool,
    max_intensity: u8,
    max_duration_ms: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapRuntimeRequest {
    session_id: String,
    device_id: String,
    session_key_base64: String,
    server_signing_public_key: String,
    max_intensity: u8,
    max_duration_ms: u64,
}

mod commands {
    use super::{
        decode_ed25519_public_key, decode_fixed_base64, ArmedSession, BootstrapRuntimeRequest,
        CompanionState, SessionView, State, TelemetryEvent,
    };

    #[tauri::command]
    pub fn bootstrap_runtime(
        state: State<'_, CompanionState>,
        request: BootstrapRuntimeRequest,
    ) -> Result<SessionView, String> {
        let session_key =
            decode_fixed_base64::<32>(&request.session_key_base64, "session_key_base64")?;
        let server_public_key = decode_ed25519_public_key(&request.server_signing_public_key)?;
        let mut runtime = state.runtime.lock().expect("poisoned lock");
        runtime.arm_session(ArmedSession {
            session_id: request.session_id.clone(),
            device_id: request.device_id.clone(),
            session_key,
            server_public_key,
            max_intensity: request.max_intensity,
            max_duration_ms: request.max_duration_ms,
        });
        Ok(SessionView {
            session_id: request.session_id,
            device_id: request.device_id,
            relay_mode: runtime.relay_mode(),
            armed: true,
            max_intensity: request.max_intensity,
            max_duration_ms: request.max_duration_ms,
        })
    }

    #[tauri::command]
    pub fn panic_stop(state: State<'_, CompanionState>) -> Result<TelemetryEvent, String> {
        let mut runtime = state.runtime.lock().expect("poisoned lock");
        runtime
            .panic_stop("operator panic stop")
            .map_err(|error| error.to_string())
    }
}

fn decode_fixed_base64<const N: usize>(value: &str, field_name: &str) -> Result<[u8; N], String> {
    let bytes = BASE64
        .decode(value.trim())
        .map_err(|error| format!("{field_name} is not valid base64: {error}"))?;
    if bytes.len() != N {
        return Err(format!(
            "{field_name} must decode to exactly {N} bytes, got {}",
            bytes.len()
        ));
    }
    let mut fixed = [0u8; N];
    fixed.copy_from_slice(&bytes);
    Ok(fixed)
}

fn decode_ed25519_public_key(value: &str) -> Result<[u8; 32], String> {
    let bytes = BASE64
        .decode(value.trim())
        .map_err(|error| format!("server_signing_public_key is not valid base64: {error}"))?;

    let raw = if bytes.len() == 32 {
        bytes.as_slice()
    } else if bytes.len() > 32 {
        &bytes[bytes.len() - 32..]
    } else {
        return Err(format!(
            "server_signing_public_key must decode to 32 raw bytes or an SPKI wrapper, got {} bytes",
            bytes.len()
        ));
    };

    let mut fixed = [0u8; 32];
    fixed.copy_from_slice(raw);
    Ok(fixed)
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

#[cfg(test)]
mod tests {
    use super::{decode_ed25519_public_key, decode_fixed_base64};

    #[test]
    fn decode_fixed_base64_rejects_wrong_length() {
        let error = decode_fixed_base64::<32>("AQID", "session_key_base64")
            .expect_err("short key should fail");
        assert!(error.contains("exactly 32 bytes"));
    }

    #[test]
    fn decode_ed25519_public_key_accepts_spki_base64() {
        let decoded = decode_ed25519_public_key(
            "MCowBQYDK2VwAyEActLEH8a4hP3A+lSi7xev4ifQuTsuEij9axOUqWioz5A=",
        )
        .expect("spki should decode");
        assert_eq!(decoded.len(), 32);
    }
}
