use std::time::{Duration, SystemTime};

use thiserror::Error;

use crate::crypto::{decrypt_command_payload, verify_command_signature, CryptoError};
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
    last_heartbeat_at: Option<SystemTime>,
}

impl<R: RelayTransport, D: DeviceBackend> CompanionRuntime<R, D> {
    pub fn new(relay: R, devices: D) -> Self {
        Self {
            relay,
            devices,
            armed_session: None,
            last_heartbeat_at: None,
        }
    }

    pub fn arm_session(&mut self, session: ArmedSession) {
        self.armed_session = Some(session);
        self.last_heartbeat_at = Some(SystemTime::now());
    }

    pub fn apply_command(
        &mut self,
        command: &ControlCommand,
    ) -> Result<TelemetryEvent, RuntimeError> {
        let session = self
            .armed_session
            .clone()
            .ok_or(RuntimeError::SessionNotArmed)?;

        if let Err(error) = verify_command_signature(command, &session.server_public_key) {
            self.devices.stop_all(&session.device_id);
            self.publish_terminal_event(
                &session,
                command.sequence,
                "stopped",
                Some("invalid-signature"),
                "invalid command signature",
            );
            return Err(RuntimeError::Crypto(error));
        }

        if command.action == "stop-all" {
            self.devices.stop_all(&session.device_id);
            return Ok(self.publish_terminal_event(
                &session,
                command.sequence,
                "stopped",
                None,
                "server stop-all",
            ));
        }
        if command.action == "heartbeat" {
            self.last_heartbeat_at = Some(SystemTime::now());
            let event = self.emit(command, "ack", "heartbeat-received", 0.0, None, None);
            self.relay.publish(event.clone());
            return Ok(event);
        }
        if command.intensity > session.max_intensity
            || command.duration_ms > session.max_duration_ms
        {
            self.devices.stop_all(&session.device_id);
            self.publish_terminal_event(
                &session,
                command.sequence,
                "stopped",
                Some("out-of-bounds"),
                "command exceeds current session limits",
            );
            return Err(RuntimeError::OutOfBounds);
        }
        let payload = match decrypt_command_payload(command, &session.session_key) {
            Ok(payload) => payload,
            Err(error) => {
                self.devices.stop_all(&session.device_id);
                self.publish_terminal_event(
                    &session,
                    command.sequence,
                    "stopped",
                    Some("invalid-payload"),
                    "command payload rejected",
                );
                return Err(RuntimeError::Crypto(error));
            }
        };
        if payload.expires_at <= rfc3339_now() {
            self.devices.stop_all(&session.device_id);
            self.publish_terminal_event(
                &session,
                command.sequence,
                "stopped",
                Some("expired-command"),
                "command expired",
            );
            return Err(RuntimeError::Expired);
        }
        self.devices.apply(
            &session.device_id,
            payload.intensity,
            payload.duration_ms,
            &payload.pattern_id,
        );
        let event = self.emit(command, "ack", "command-accepted", 25.0, None, None);
        self.relay.publish(event.clone());
        Ok(event)
    }

    pub fn check_safety(&mut self) -> Result<(), RuntimeError> {
        let session = self
            .armed_session
            .clone()
            .ok_or(RuntimeError::SessionNotArmed)?;
        let last_hb = self
            .last_heartbeat_at
            .ok_or(RuntimeError::SessionNotArmed)?;
        if last_hb.elapsed().unwrap_or(Duration::from_secs(999)) > Duration::from_millis(500) {
            self.devices.stop_all(&session.device_id);
            self.publish_terminal_event(
                &session,
                0,
                "stopped",
                Some("heartbeat-timeout"),
                "autonomous-heartbeat-timeout",
            );
            return Err(RuntimeError::Expired);
        }
        Ok(())
    }

    pub fn panic_stop(&mut self, reason: &str) -> Result<TelemetryEvent, RuntimeError> {
        let session = self
            .armed_session
            .clone()
            .ok_or(RuntimeError::SessionNotArmed)?;
        self.devices.stop_all(&session.device_id);
        Ok(self.publish_terminal_event(&session, 0, "stopped", None, reason))
    }

    pub fn background_permission_lost(&mut self) -> Result<TelemetryEvent, RuntimeError> {
        let session = self
            .armed_session
            .clone()
            .ok_or(RuntimeError::SessionNotArmed)?;
        self.devices.background_permission_lost(&session.device_id);
        Ok(self.publish_terminal_event(
            &session,
            0,
            "background-permission-lost",
            None,
            "background permission lost",
        ))
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
        error_code: Option<&str>,
        stop_reason: Option<&str>,
    ) -> TelemetryEvent {
        TelemetryEvent {
            session_id: command.session_id.clone(),
            sequence: command.sequence,
            status: status.to_string(),
            executed_at: rfc3339_now(),
            device_state: device_state.to_string(),
            latency_ms,
            error_code: error_code.map(str::to_string),
            stop_reason: stop_reason.map(str::to_string),
        }
    }

    fn publish_terminal_event(
        &mut self,
        session: &ArmedSession,
        sequence: i64,
        device_state: &str,
        error_code: Option<&str>,
        stop_reason: &str,
    ) -> TelemetryEvent {
        let event = TelemetryEvent {
            session_id: session.session_id.clone(),
            sequence,
            status: "stopped".to_string(),
            executed_at: rfc3339_now(),
            device_state: device_state.to_string(),
            latency_ms: 0.0,
            error_code: error_code.map(str::to_string),
            stop_reason: Some(stop_reason.to_string()),
        };
        self.armed_session = None;
        self.last_heartbeat_at = None;
        self.relay.publish(event.clone());
        event
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
    use ed25519_dalek::{Signer, SigningKey};
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
            server_public_key: [0u8; 32],
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
    fn runtime_triggers_panic_stop_on_heartbeat_timeout() {
        let relay = MockRelayTransport::new("cloudflare-realtime");
        let devices = MockDeviceBackend::with_device("device_demo");
        let mut runtime = CompanionRuntime::new(relay.clone(), devices);
        runtime.arm_session(ArmedSession {
            session_id: "session_demo".to_string(),
            device_id: "device_demo".to_string(),
            session_key: [7u8; 32],
            server_public_key: [0u8; 32],
            max_intensity: 88,
            max_duration_ms: 12_000,
        });

        runtime.check_safety().expect("initially safe");
        runtime.last_heartbeat_at = Some(SystemTime::now() - Duration::from_millis(600));

        let res = runtime.check_safety();
        assert!(res.is_err());
        assert_eq!(relay.events().len(), 1);
        assert_eq!(
            relay.events()[0].error_code,
            Some("heartbeat-timeout".to_string())
        );
    }

    #[test]
    fn runtime_applies_valid_command() {
        let relay = MockRelayTransport::new("cloudflare-realtime");
        let devices = MockDeviceBackend::with_device("device_demo");
        let mut runtime = CompanionRuntime::new(relay.clone(), devices);
        let session_key = [7u8; 32];
        let signing_key = SigningKey::from_bytes(&[1u8; 32]);
        let server_public_key = signing_key.verifying_key().to_bytes();

        runtime.arm_session(ArmedSession {
            session_id: "session_demo".to_string(),
            device_id: "device_demo".to_string(),
            session_key,
            server_public_key,
            max_intensity: 88,
            max_duration_ms: 12_000,
        });

        let command = encrypt_and_sign_command(&signing_key, &session_key, 42, 8_400);
        let telemetry = runtime
            .apply_command(&command)
            .expect("command should apply");
        assert_eq!(telemetry.status, "ack");
        assert_eq!(relay.events().len(), 1);
    }

    #[test]
    fn runtime_rejects_invalid_signature_and_stops_session() {
        let relay = MockRelayTransport::new("cloudflare-realtime");
        let devices = MockDeviceBackend::with_device("device_demo");
        let mut runtime = CompanionRuntime::new(relay.clone(), devices);
        let session_key = [7u8; 32];
        let expected_signing_key = SigningKey::from_bytes(&[1u8; 32]);
        let wrong_signing_key = SigningKey::from_bytes(&[2u8; 32]);

        runtime.arm_session(ArmedSession {
            session_id: "session_demo".to_string(),
            device_id: "device_demo".to_string(),
            session_key,
            server_public_key: expected_signing_key.verifying_key().to_bytes(),
            max_intensity: 88,
            max_duration_ms: 12_000,
        });

        let command = encrypt_and_sign_command(&wrong_signing_key, &session_key, 42, 8_400);
        let error = runtime
            .apply_command(&command)
            .expect_err("invalid signature should fail");
        assert!(matches!(
            error,
            RuntimeError::Crypto(CryptoError::InvalidSignature)
        ));
        assert_eq!(relay.events().len(), 1);
        assert_eq!(relay.events()[0].status, "stopped");
        assert_eq!(
            relay.events()[0].error_code,
            Some("invalid-signature".to_string())
        );
        assert_eq!(
            relay.events()[0].stop_reason,
            Some("invalid command signature".to_string())
        );
    }

    #[test]
    fn runtime_rejects_expired_command_and_emits_terminal_telemetry() {
        let relay = MockRelayTransport::new("cloudflare-realtime");
        let devices = MockDeviceBackend::with_device("device_demo");
        let mut runtime = CompanionRuntime::new(relay.clone(), devices);
        let session_key = [7u8; 32];
        let signing_key = SigningKey::from_bytes(&[1u8; 32]);

        runtime.arm_session(ArmedSession {
            session_id: "session_demo".to_string(),
            device_id: "device_demo".to_string(),
            session_key,
            server_public_key: signing_key.verifying_key().to_bytes(),
            max_intensity: 88,
            max_duration_ms: 12_000,
        });

        let command = encrypt_and_sign_command_with_expiry(
            &signing_key,
            &session_key,
            42,
            8_400,
            SystemTime::now() - Duration::from_secs(1),
        );
        let error = runtime
            .apply_command(&command)
            .expect_err("expired command should fail");
        assert!(matches!(error, RuntimeError::Expired));
        assert_eq!(relay.events().len(), 1);
        assert_eq!(
            relay.events()[0].error_code,
            Some("expired-command".to_string())
        );
        assert_eq!(
            relay.events()[0].stop_reason,
            Some("command expired".to_string())
        );
    }

    #[test]
    fn runtime_delivers_stop_all_telemetry() {
        let relay = MockRelayTransport::new("cloudflare-realtime");
        let devices = MockDeviceBackend::with_device("device_demo");
        let mut runtime = CompanionRuntime::new(relay.clone(), devices);
        let signing_key = SigningKey::from_bytes(&[1u8; 32]);

        runtime.arm_session(ArmedSession {
            session_id: "session_demo".to_string(),
            device_id: "device_demo".to_string(),
            session_key: [7u8; 32],
            server_public_key: signing_key.verifying_key().to_bytes(),
            max_intensity: 88,
            max_duration_ms: 12_000,
        });

        let command = sign_command(
            &signing_key,
            ControlCommand {
                session_id: "session_demo".to_string(),
                sequence: 3,
                device_id: "device_demo".to_string(),
                action: "stop-all".to_string(),
                intensity: 0,
                duration_ms: 0,
                pattern_id: String::new(),
                nonce: String::new(),
                issued_at: "2026-03-14T03:00:00Z".to_string(),
                expires_at: "2026-03-14T03:00:00Z".to_string(),
                ciphertext: String::new(),
                signature: String::new(),
            },
        );

        let event = runtime
            .apply_command(&command)
            .expect("stop-all should publish telemetry");
        assert_eq!(event.status, "stopped");
        assert_eq!(event.sequence, 3);
        assert_eq!(relay.events().len(), 1);
        assert_eq!(relay.events()[0], event);
        assert!(matches!(
            runtime.apply_command(&command),
            Err(RuntimeError::SessionNotArmed)
        ));
    }

    fn encrypt_and_sign_command(
        signing_key: &SigningKey,
        session_key: &[u8; 32],
        intensity: u8,
        duration_ms: u64,
    ) -> ControlCommand {
        encrypt_and_sign_command_with_expiry(
            signing_key,
            session_key,
            intensity,
            duration_ms,
            SystemTime::now() + Duration::from_secs(60),
        )
    }

    fn encrypt_and_sign_command_with_expiry(
        signing_key: &SigningKey,
        session_key: &[u8; 32],
        intensity: u8,
        duration_ms: u64,
        expires_at: SystemTime,
    ) -> ControlCommand {
        let payload = CommandPayload {
            session_id: "session_demo".to_string(),
            device_id: "device_demo".to_string(),
            action: "apply".to_string(),
            intensity,
            duration_ms,
            pattern_id: "pulse-wave".to_string(),
            issued_at: "2026-03-14T03:00:00Z".to_string(),
            expires_at: humantime::format_rfc3339_seconds(expires_at).to_string(),
        };
        let cipher = Aes256Gcm::new_from_slice(session_key).expect("cipher");
        let nonce = [1u8; 12];
        let ciphertext = cipher
            .encrypt(
                Nonce::from_slice(&nonce),
                to_vec(&payload).expect("payload").as_ref(),
            )
            .expect("encrypt");
        sign_command(
            signing_key,
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
            },
        )
    }

    fn sign_command(signing_key: &SigningKey, mut command: ControlCommand) -> ControlCommand {
        let canonical = crate::crypto::canonical_command(&command).expect("canonical");
        let sig = signing_key.sign(&canonical);
        command.signature = BASE64.encode(sig.to_bytes());
        command
    }
}
