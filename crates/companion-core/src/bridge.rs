use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

use crate::device::DeviceBackend;
use crate::model::ArmedSession;
use crate::relay::RelayTransport;
use crate::runtime::CompanionRuntime;

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BridgeIncoming {
    Auth { token: String },
    Apply { intensity: u8, duration_ms: u64, pattern_id: String },
    Stop,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BridgeOutgoing {
    AuthSuccess,
    AuthFailed { reason: String },
    Error { message: String },
    Telemetry { status: String, device_state: String },
}

pub struct LocalBridge<R: RelayTransport + 'static, D: DeviceBackend + 'static> {
    runtime: Arc<Mutex<CompanionRuntime<R, D>>>,
    token: String,
}

impl<R: RelayTransport + 'static, D: DeviceBackend + 'static> LocalBridge<R, D> {
    pub fn new(runtime: Arc<Mutex<CompanionRuntime<R, D>>>, token: String) -> Self {
        Self { runtime, token }
    }

    pub async fn run(&self, addr: &str) -> Result<(), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind(addr).await?;
        let runtime = self.runtime.clone();
        let token = self.token.clone();

        tokio::spawn(async move {
            while let Ok((stream, peer)) = listener.accept().await {
                let runtime = runtime.clone();
                let token = token.clone();
                tokio::spawn(handle_connection(stream, peer, runtime, token));
            }
        });

        Ok(())
    }
}

async fn handle_connection<R: RelayTransport, D: DeviceBackend>(
    stream: TcpStream,
    peer: SocketAddr,
    runtime: Arc<Mutex<CompanionRuntime<R, D>>>,
    token: String,
) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(_) => return,
    };

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
    let mut authenticated = false;

    while let Some(msg) = ws_receiver.next().await {
        let msg = match msg {
            Ok(Message::Text(t)) => t,
            _ => continue,
        };

        let incoming: BridgeIncoming = match serde_json::from_str(&msg) {
            Ok(i) => i,
            Err(e) => {
                let _ = ws_sender.send(Message::Text(serde_json::to_string(&BridgeOutgoing::Error { message: e.to_string() }).unwrap())).await;
                continue;
            }
        };

        if !authenticated {
            if let BridgeIncoming::Auth { token: provided } = incoming {
                if provided == token {
                    authenticated = true;
                    let _ = ws_sender.send(Message::Text(serde_json::to_string(&BridgeOutgoing::AuthSuccess).unwrap())).await;
                } else {
                    let _ = ws_sender.send(Message::Text(serde_json::to_string(&BridgeOutgoing::AuthFailed { reason: "invalid token".into() }).unwrap())).await;
                    return;
                }
            } else {
                let _ = ws_sender.send(Message::Text(serde_json::to_string(&BridgeOutgoing::AuthFailed { reason: "authentication required".into() }).unwrap())).await;
                return;
            }
            continue;
        }

        let mut rt = runtime.lock().await;
        match incoming {
            BridgeIncoming::Apply { intensity, duration_ms, pattern_id } => {
                // For local bridge, we bypass signature verification because it is locally authenticated
                // but we still respect session limits.
                if let Some(session) = rt.armed_session_clone() {
                   if intensity > session.max_intensity || duration_ms > session.max_duration_ms {
                        let _ = ws_sender.send(Message::Text(serde_json::to_string(&BridgeOutgoing::Error { message: "out of bounds".into() }).unwrap())).await;
                        continue;
                   }
                   rt.apply_local_command(intensity, duration_ms, &pattern_id);
                   let _ = ws_sender.send(Message::Text(serde_json::to_string(&BridgeOutgoing::Telemetry { status: "ack".into(), device_state: "executing".into() }).unwrap())).await;
                } else {
                    let _ = ws_sender.send(Message::Text(serde_json::to_string(&BridgeOutgoing::Error { message: "no armed session".into() }).unwrap())).await;
                }
            }
            BridgeIncoming::Stop => {
                let _ = rt.panic_stop("bridge-stop");
                let _ = ws_sender.send(Message::Text(serde_json::to_string(&BridgeOutgoing::Telemetry { status: "stopped".into(), device_state: "stopped".into() }).unwrap())).await;
            }
            BridgeIncoming::Auth { .. } => {}
        }
    }
}
