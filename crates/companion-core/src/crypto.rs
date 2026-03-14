use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine;
use ed25519_dalek::{Signature, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use serde_json::json;
use thiserror::Error;
use x25519_dalek::{PublicKey, StaticSecret};

use crate::model::{CommandPayload, ControlCommand, PairingBundle};

const BASE64: base64::engine::GeneralPurpose = base64::engine::general_purpose::STANDARD;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("base64 decoding failed: {0}")]
    Base64(#[from] base64::DecodeError),
    #[error("aes-gcm operation failed")]
    Aead,
    #[error("serde json failed: {0}")]
    Json(#[from] serde_json::Error),
    #[error("signature is invalid")]
    InvalidSignature,
    #[error("invalid Ed25519 public key")]
    InvalidPublicKey,
}

pub fn new_transport_secret() -> StaticSecret {
    StaticSecret::random_from_rng(OsRng)
}

pub fn transport_public_key(secret: &StaticSecret) -> PublicKey {
    PublicKey::from(secret)
}

pub fn decrypt_session_key(
    bundle: &PairingBundle,
    secret: &StaticSecret,
) -> Result<[u8; 32], CryptoError> {
    let server_public_der = BASE64.decode(&bundle.server_transport_public_key)?;
    let server_public_raw = server_public_der
        .get(server_public_der.len().saturating_sub(32)..)
        .ok_or(CryptoError::Aead)?;
    let mut raw = [0u8; 32];
    raw.copy_from_slice(server_public_raw);
    let shared_secret = secret.diffie_hellman(&PublicKey::from(raw));
    let cipher =
        Aes256Gcm::new_from_slice(shared_secret.as_bytes()).map_err(|_| CryptoError::Aead)?;
    let nonce_bytes = BASE64.decode(&bundle.nonce)?;
    let ciphertext = BASE64.decode(&bundle.ciphertext)?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce_bytes), ciphertext.as_ref())
        .map_err(|_| CryptoError::Aead)?;
    let mut session_key = [0u8; 32];
    session_key.copy_from_slice(&plaintext[..32]);
    Ok(session_key)
}

pub fn verify_command_signature(
    command: &ControlCommand,
    server_public_key_raw: &[u8],
) -> Result<(), CryptoError> {
    let verifying_key = VerifyingKey::from_bytes(
        server_public_key_raw
            .try_into()
            .map_err(|_| CryptoError::InvalidPublicKey)?,
    )
    .map_err(|_| CryptoError::InvalidPublicKey)?;
    let payload = canonical_command(command)?;
    let signature_bytes = BASE64.decode(&command.signature)?;
    let signature =
        Signature::from_slice(&signature_bytes).map_err(|_| CryptoError::InvalidSignature)?;
    verifying_key
        .verify(&payload, &signature)
        .map_err(|_| CryptoError::InvalidSignature)
}

pub fn decrypt_command_payload(
    command: &ControlCommand,
    session_key: &[u8; 32],
) -> Result<CommandPayload, CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(session_key).map_err(|_| CryptoError::Aead)?;
    let nonce_bytes = BASE64.decode(&command.nonce)?;
    let ciphertext = BASE64.decode(&command.ciphertext)?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce_bytes), ciphertext.as_ref())
        .map_err(|_| CryptoError::Aead)?;
    Ok(serde_json::from_slice::<CommandPayload>(&plaintext)?)
}

pub fn deterministic_identity(seed: &[u8; 32]) -> SigningKey {
    SigningKey::from_bytes(seed)
}

fn canonical_command(command: &ControlCommand) -> Result<Vec<u8>, CryptoError> {
    Ok(serde_json::to_vec(&json!({
        "session_id": command.session_id,
        "sequence": command.sequence,
        "device_id": command.device_id,
        "action": command.action,
        "intensity": command.intensity,
        "duration_ms": command.duration_ms,
        "pattern_id": command.pattern_id,
        "nonce": command.nonce,
        "issued_at": command.issued_at,
        "expires_at": command.expires_at,
        "ciphertext": command.ciphertext
    }))?)
}
