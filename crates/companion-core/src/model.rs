use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct PairingBundle {
    pub server_transport_public_key: String,
    pub nonce: String,
    pub ciphertext: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct ControlCommand {
    pub session_id: String,
    pub sequence: i64,
    pub device_id: String,
    pub action: String,
    pub intensity: u8,
    pub duration_ms: u64,
    pub pattern_id: String,
    pub nonce: String,
    pub issued_at: String,
    pub expires_at: String,
    pub ciphertext: String,
    pub signature: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct CommandPayload {
    pub session_id: String,
    pub device_id: String,
    pub action: String,
    pub intensity: u8,
    pub duration_ms: u64,
    pub pattern_id: String,
    pub issued_at: String,
    pub expires_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct TelemetryEvent {
    pub session_id: String,
    pub sequence: i64,
    pub status: String,
    pub executed_at: String,
    pub device_state: String,
    pub latency_ms: f64,
    pub error_code: Option<String>,
    pub stop_reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct DeviceState {
    pub device_id: String,
    pub connected: bool,
    pub last_command_sequence: i64,
    pub active_pattern: String,
    pub current_intensity: u8,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArmedSession {
    pub session_id: String,
    pub device_id: String,
    pub session_key: [u8; 32],
    pub server_public_key: [u8; 32],
    pub max_intensity: u8,
    pub max_duration_ms: u64,
}
