package secure

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/taas-hq/taas/internal/domain"
)

type Engine struct {
	serverSigningPrivate ed25519.PrivateKey
	serverSigningPublic  ed25519.PublicKey
}

type SignedPayload struct {
	Nonce      string
	Ciphertext string
	Signature  string
}

func NewEngine(seed []byte) *Engine {
	hash := sha256.Sum256(seed)
	privateKey := ed25519.NewKeyFromSeed(hash[:])
	return &Engine{
		serverSigningPrivate: privateKey,
		serverSigningPublic:  privateKey.Public().(ed25519.PublicKey),
	}
}

func (e *Engine) ServerSigningPublicKeySPKI() (string, error) {
	publicDER, err := x509.MarshalPKIXPublicKey(e.serverSigningPublic)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(publicDER), nil
}

func ParseEd25519PublicKeySPKI(spkiBase64 string) (ed25519.PublicKey, error) {
	der, err := base64.StdEncoding.DecodeString(spkiBase64)
	if err != nil {
		return nil, err
	}
	parsed, err := x509.ParsePKIXPublicKey(der)
	if err != nil {
		return nil, err
	}
	publicKey, ok := parsed.(ed25519.PublicKey)
	if !ok {
		return nil, errors.New("public key is not Ed25519")
	}
	return publicKey, nil
}

func ParseX25519PublicKey(base64Value string) (*ecdh.PublicKey, error) {
	raw, err := base64.StdEncoding.DecodeString(base64Value)
	if err != nil {
		return nil, err
	}
	if len(raw) == 32 {
		return ecdh.X25519().NewPublicKey(raw)
	}
	parsed, err := x509.ParsePKIXPublicKey(raw)
	if err != nil {
		return nil, err
	}
	publicKey, ok := parsed.(*ecdh.PublicKey)
	if !ok {
		return nil, errors.New("public key is not X25519")
	}
	return publicKey, nil
}

func (e *Engine) WrapSessionKey(peerTransportPublicKey string, sessionKey []byte) (domain.PairingBundle, error) {
	peerPublicKey, err := ParseX25519PublicKey(peerTransportPublicKey)
	if err != nil {
		return domain.PairingBundle{}, err
	}
	serverPrivateKey, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		return domain.PairingBundle{}, err
	}
	sharedSecret, err := serverPrivateKey.ECDH(peerPublicKey)
	if err != nil {
		return domain.PairingBundle{}, err
	}
	wrappingKey := sha256.Sum256(sharedSecret)
	nonce := make([]byte, 12)
	if _, err := rand.Read(nonce); err != nil {
		return domain.PairingBundle{}, err
	}
	block, err := aes.NewCipher(wrappingKey[:])
	if err != nil {
		return domain.PairingBundle{}, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return domain.PairingBundle{}, err
	}
	ciphertext := gcm.Seal(nil, nonce, sessionKey, nil)
	serverPublicKeyDER, err := x509.MarshalPKIXPublicKey(serverPrivateKey.PublicKey())
	if err != nil {
		return domain.PairingBundle{}, err
	}
	return domain.PairingBundle{
		ServerTransportPublicKey: base64.StdEncoding.EncodeToString(serverPublicKeyDER),
		Nonce:                    base64.StdEncoding.EncodeToString(nonce),
		Ciphertext:               base64.StdEncoding.EncodeToString(ciphertext),
	}, nil
}

func (e *Engine) GenerateSessionKey() ([]byte, error) {
	sessionKey := make([]byte, 32)
	_, err := rand.Read(sessionKey)
	return sessionKey, err
}

func (e *Engine) CanonicalizeInboundEvent(event domain.InboundEvent) ([]byte, error) {
	type canonicalInboundEvent struct {
		Amount         float64        `json:"amount"`
		CreatorID      string         `json:"creator_id"`
		Currency       string         `json:"currency"`
		EventType      string         `json:"event_type"`
		IdempotencyKey string         `json:"idempotency_key"`
		Metadata       map[string]any `json:"metadata"`
		OccurredAt     string         `json:"occurred_at"`
		SourceID       string         `json:"source_id"`
		WorkspaceID    string         `json:"workspace_id"`
	}
	return json.Marshal(canonicalInboundEvent{
		Amount:         event.Amount,
		CreatorID:      event.CreatorID,
		Currency:       event.Currency,
		EventType:      event.EventType,
		IdempotencyKey: event.IdempotencyKey,
		Metadata:       event.Metadata,
		OccurredAt:     event.OccurredAt.Format(time.RFC3339Nano),
		SourceID:       event.SourceID,
		WorkspaceID:    event.WorkspaceID,
	})
}

func (e *Engine) VerifyInboundSignature(event domain.InboundEvent, publicKeySPKI string) error {
	payload, err := e.CanonicalizeInboundEvent(event)
	if err != nil {
		return err
	}
	publicKey, err := ParseEd25519PublicKeySPKI(publicKeySPKI)
	if err != nil {
		return err
	}
	signature, err := base64.StdEncoding.DecodeString(event.Signature)
	if err != nil {
		return err
	}
	if !ed25519.Verify(publicKey, payload, signature) {
		return errors.New("invalid inbound signature")
	}
	return nil
}

func DeriveBridgeToken(sessionID, bridgeID string, sessionKey []byte) string {
	mac := hmac.New(sha256.New, sessionKey)
	_, _ = mac.Write([]byte("bridge-token:v1:"))
	_, _ = mac.Write([]byte(sessionID))
	_, _ = mac.Write([]byte(":"))
	_, _ = mac.Write([]byte(bridgeID))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func VerifyBridgeToken(rawToken, sessionID, bridgeID string, sessionKey []byte) bool {
	if rawToken == "" {
		return false
	}
	expected := DeriveBridgeToken(sessionID, bridgeID, sessionKey)
	return hmac.Equal([]byte(expected), []byte(rawToken))
}

func (e *Engine) EncryptCommand(command domain.CommandPayload, sessionKey []byte) (SignedPayload, error) {
	commandBytes, err := json.Marshal(command)
	if err != nil {
		return SignedPayload{}, err
	}
	nonce := make([]byte, 12)
	if _, err := rand.Read(nonce); err != nil {
		return SignedPayload{}, err
	}
	block, err := aes.NewCipher(sessionKey)
	if err != nil {
		return SignedPayload{}, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return SignedPayload{}, err
	}
	ciphertext := gcm.Seal(nil, nonce, commandBytes, nil)
	signaturePayload, err := canonicalCommandForSignature(command, ciphertext, nonce)
	if err != nil {
		return SignedPayload{}, err
	}
	signature := ed25519.Sign(e.serverSigningPrivate, signaturePayload)
	return SignedPayload{
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
		Signature:  base64.StdEncoding.EncodeToString(signature),
	}, nil
}

func (e *Engine) SignControlCommand(command domain.ControlCommand) (string, error) {
	payload, err := canonicalControlCommand(command)
	if err != nil {
		return "", err
	}
	signature := ed25519.Sign(e.serverSigningPrivate, payload)
	return base64.StdEncoding.EncodeToString(signature), nil
}

func (e *Engine) SignStopCommand(command domain.ControlCommand) (string, error) {
	return e.SignControlCommand(command)
}

func canonicalCommandForSignature(command domain.CommandPayload, ciphertext []byte, nonce []byte) ([]byte, error) {
	controlCommand := domain.ControlCommand{
		SessionID:  command.SessionID,
		Sequence:   0,
		DeviceID:   command.DeviceID,
		Action:     command.Action,
		Intensity:  command.Intensity,
		DurationMS: command.DurationMS,
		PatternID:  command.PatternID,
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		IssuedAt:   command.IssuedAt,
		ExpiresAt:  command.ExpiresAt,
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
	}
	return canonicalControlCommand(controlCommand)
}

func canonicalControlCommand(command domain.ControlCommand) ([]byte, error) {
	type canonical struct {
		SessionID  string               `json:"session_id"`
		Sequence   int64                `json:"sequence"`
		DeviceID   string               `json:"device_id"`
		Action     domain.CommandAction `json:"action"`
		Intensity  int                  `json:"intensity"`
		DurationMS int                  `json:"duration_ms"`
		PatternID  string               `json:"pattern_id"`
		Nonce      string               `json:"nonce"`
		IssuedAt   string               `json:"issued_at"`
		ExpiresAt  string               `json:"expires_at"`
		Ciphertext string               `json:"ciphertext"`
	}
	return json.Marshal(canonical{
		SessionID:  command.SessionID,
		Sequence:   command.Sequence,
		DeviceID:   command.DeviceID,
		Action:     command.Action,
		Intensity:  command.Intensity,
		DurationMS: command.DurationMS,
		PatternID:  command.PatternID,
		Nonce:      command.Nonce,
		IssuedAt:   command.IssuedAt.Format(time.RFC3339Nano),
		ExpiresAt:  command.ExpiresAt.Format(time.RFC3339Nano),
		Ciphertext: command.Ciphertext,
	})
}

func VerifyCommandSignature(command domain.ControlCommand, publicKeySPKI string) error {
	publicKey, err := ParseEd25519PublicKeySPKI(publicKeySPKI)
	if err != nil {
		return err
	}
	payload, err := canonicalControlCommand(command)
	if err != nil {
		return err
	}
	signature, err := base64.StdEncoding.DecodeString(command.Signature)
	if err != nil {
		return err
	}
	if !ed25519.Verify(publicKey, payload, signature) {
		return fmt.Errorf("invalid control command signature")
	}
	return nil
}

func DecryptCommandPayload(command domain.ControlCommand, sessionKey []byte) (domain.CommandPayload, error) {
	nonce, err := base64.StdEncoding.DecodeString(command.Nonce)
	if err != nil {
		return domain.CommandPayload{}, err
	}
	ciphertext, err := base64.StdEncoding.DecodeString(command.Ciphertext)
	if err != nil {
		return domain.CommandPayload{}, err
	}
	block, err := aes.NewCipher(sessionKey)
	if err != nil {
		return domain.CommandPayload{}, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return domain.CommandPayload{}, err
	}
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return domain.CommandPayload{}, err
	}
	var payload domain.CommandPayload
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		return domain.CommandPayload{}, err
	}
	return payload, nil
}

func Base64Equal(left, right string) bool {
	leftBytes, err := base64.StdEncoding.DecodeString(left)
	if err != nil {
		return false
	}
	rightBytes, err := base64.StdEncoding.DecodeString(right)
	if err != nil {
		return false
	}
	return bytes.Equal(leftBytes, rightBytes)
}
