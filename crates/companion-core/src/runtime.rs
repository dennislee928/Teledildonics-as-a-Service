use std::time::SystemTime;

use thiserror::Error;

use crate::crypto::{decrypt_command_payload, CryptoError};
use crate::device::DeviceBackend;
use crate::model::{ArmedSession, ControlCommand, TelemetryEvent};
use crate::relay::RelayTransport;

#[derive(Debug, Error)]
pub enum RuntimeError {
    #[error("session is not armed")]
    SessionNotArmed,
    #[error("command exceeds current session limits")]
    OutOfBounds,
    #[error("command expired")]
    Expired,
    #[error(transparent)]
    Crypto(#[from] CryptoError),
}

pub struct CompanionRuntime<R: RelayTransport, D: DeviceBackend> {
    relay: R,
    devices: D,
    armed_session: Option<ArmedSession>,
}

impl<R: RelayTransport, D: DeviceBackend> CompanionRuntime<R, D> {
    pub fn new(relay: R, devices: D) -> Self {
        Self {
            relay,
            devices,
            armed_session: None,
        }
    }

    pub fn arm_session(&mut self, session: ArmedSession) {
        self.armed_session = Some(session);
    }

    pub fn apply_command(
        &mut self,
        command: &ControlCommand,
    ) -> Result<TelemetryEvent, RuntimeError> {
        let session = self
            .armed_session
            .clone()
            .ok_or(RuntimeError::SessionNotArmed)?;
        if command.action == "stop-all" {
            self.devices.stop_all(&session.device_id);
            return Ok(self.emit(command, "stopped", "stopped", 0.0, Some("panic-stop")));
        }
        if command.intensity > session.max_intensity
            || command.duration_ms > session.max_duration_ms
        {
            self.devices.stop_all(&session.device_id);
            return Err(RuntimeError::OutOfBounds);
        }
        let payload = decrypt_command_payload(command, &session.session_key)?;
        if payload.expires_at <= rfc3339_now() {
            self.devices.stop_all(&session.device_id);
            return Err(RuntimeError::Expired);
        }
        self.devices.apply(
            &session.device_id,
            payload.intensity,
            payload.duration_ms,
            &payload.pattern_id,
        );
        let event = self.emit(command, "ack", "command-accepted", 25.0, None);
        self.relay.publish(event.clone());
        Ok(event)
    }

    pub fn panic_stop(&mut self, reason: &str) -> Result<TelemetryEvent, RuntimeError> {
        let session = self
            .armed_session
            .clone()
            .ok_or(RuntimeError::SessionNotArmed)?;
        self.devices.stop_all(&session.device_id);
        let event = TelemetryEvent {
            session_id: session.session_id,
            sequence: 0,
            status: "stopped".to_string(),
            executed_at: rfc3339_now(),
            device_state: "stopped".to_string(),
            latency_ms: 0.0,
            error_code: None,
            stop_reason: Some(reason.to_string()),
        };
        self.relay.publish(event.clone());
        Ok(event)
    }

    pub fn background_permission_lost(&mut self) -> Result<TelemetryEvent, RuntimeError> {
        let session = self
            .armed_session
            .clone()
            .ok_or(RuntimeError::SessionNotArmed)?;
        self.devices.background_permission_lost(&session.device_id);
        let event = TelemetryEvent {
            session_id: session.session_id,
            sequence: 0,
            status: "stopped".to_string(),
            executed_at: rfc3339_now(),
            device_state: "background-permission-lost".to_string(),
            latency_ms: 0.0,
            error_code: None,
            stop_reason: Some("background permission lost".to_string()),
        };
        self.relay.publish(event.clone());
        Ok(event)
    }

    pub fn relay_mode(&self) -> &'static str {
        self.relay.presence_mode()
    }

    fn emit(
        &self,
        command: &ControlCommand,
        status: &str,
        device_state: &str,
        latency_ms: f64,
        stop_reason: Option<&str>,
    ) -> TelemetryEvent {
        TelemetryEvent {
            session_id: command.session_id.clone(),
            sequence: command.sequence,
            status: status.to_string(),
            executed_at: rfc3339_now(),
            device_state: device_state.to_string(),
            latency_ms,
            error_code: None,
            stop_reason: stop_reason.map(str::to_string),
        }
    }
}

fn rfc3339_now() -> String {
    humantime::format_rfc3339_seconds(SystemTime::now()).to_string()
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use aes_gcm::aead::{Aead, KeyInit};
    use aes_gcm::{Aes256Gcm, Nonce};
    use base64::Engine;
    use serde_json::to_vec;

    use super::*;
    use crate::device::MockDeviceBackend;
    use crate::model::{ArmedSession, CommandPayload, ControlCommand};
    use crate::relay::MockRelayTransport;

    const BASE64: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;

    #[test]
    fn runtime_panics_stops_when_background_permission_is_lost() {
        let relay = MockRelayTransport::new("websocket-fallback");
        let devices = MockDeviceBackend::with_device("device_demo");
        let mut runtime = CompanionRuntime::new(relay.clone(), devices);
        runtime.arm_session(ArmedSession {
            session_id: "session_demo".to_string(),
            device_id: "device_demo".to_string(),
            session_key: [9u8; 32],
            max_intensity: 88,
            max_duration_ms: 12_000,
        });
        let event = runtime
            .background_permission_lost()
            .expect("background loss should stop");
        assert_eq!(event.status, "stopped");
        assert_eq!(runtime.relay_mode(), "websocket-fallback");
        assert_eq!(relay.events().len(), 1);
    }

    #[test]
    fn runtime_applies_valid_command() {
        let relay = MockRelayTransport::new("cloudflare-realtime");
        let devices = MockDeviceBackend::with_device("device_demo");
        let mut runtime = CompanionRuntime::new(relay.clone(), devices);
        let session_key = [7u8; 32];
        runtime.arm_session(ArmedSession {
            session_id: "session_demo".to_string(),
            device_id: "device_demo".to_string(),
            session_key,
            max_intensity: 88,
            max_duration_ms: 12_000,
        });
        let command = encrypt_command(&session_key, 42, 8_400);
        let telemetry = runtime
            .apply_command(&command)
            .expect("command should apply");
        assert_eq!(telemetry.status, "ack");
        assert_eq!(relay.events().len(), 1);
    }

    fn encrypt_command(session_key: &[u8; 32], intensity: u8, duration_ms: u64) -> ControlCommand {
        let payload = CommandPayload {
            session_id: "session_demo".to_string(),
            device_id: "device_demo".to_string(),
            action: "apply".to_string(),
            intensity,
            duration_ms,
            pattern_id: "pulse-wave".to_string(),
            issued_at: "2026-03-14T03:00:00Z".to_string(),
            expires_at: humantime::format_rfc3339_seconds(
                SystemTime::now() + Duration::from_secs(60),
            )
            .to_string(),
        };
        let cipher = Aes256Gcm::new_from_slice(session_key).expect("cipher");
        let nonce = [1u8; 12];
        let ciphertext = cipher
            .encrypt(
                Nonce::from_slice(&nonce),
                to_vec(&payload).expect("payload").as_ref(),
            )
            .expect("encrypt");
        ControlCommand {
            session_id: "session_demo".to_string(),
            sequence: 1,
            device_id: "device_demo".to_string(),
            action: "apply".to_string(),
            intensity,
            duration_ms,
            pattern_id: "pulse-wave".to_string(),
            nonce: BASE64.encode(nonce),
            issued_at: payload.issued_at,
            expires_at: payload.expires_at,
            ciphertext: BASE64.encode(ciphertext),
            signature: String::new(),
        }
    }
}
