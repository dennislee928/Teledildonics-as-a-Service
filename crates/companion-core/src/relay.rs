use std::sync::{Arc, Mutex};

use crate::model::TelemetryEvent;

pub trait RelayTransport {
    fn publish(&self, event: TelemetryEvent);
    fn presence_mode(&self) -> &'static str;
}

#[derive(Clone, Default)]
pub struct MockRelayTransport {
    events: Arc<Mutex<Vec<TelemetryEvent>>>,
    mode: &'static str,
}

impl MockRelayTransport {
    pub fn new(mode: &'static str) -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
            mode,
        }
    }

    pub fn events(&self) -> Vec<TelemetryEvent> {
        self.events.lock().expect("poisoned lock").clone()
    }
}

impl RelayTransport for MockRelayTransport {
    fn publish(&self, event: TelemetryEvent) {
        self.events.lock().expect("poisoned lock").push(event);
    }

    fn presence_mode(&self) -> &'static str {
        self.mode
    }
}
