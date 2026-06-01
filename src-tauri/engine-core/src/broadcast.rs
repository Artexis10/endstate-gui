//! Event broadcast channel for the dev-mode HTTP bridge.
//!
//! Wrapper around tokio::sync::broadcast so engine events can be consumed by
//! both Tauri's event system (app crate) and the SSE endpoint (standalone
//! bridge) simultaneously. Tauri-free.

use std::sync::Arc;
use tokio::sync::broadcast;

/// Capacity of the broadcast channel (number of events to buffer)
const BROADCAST_CAPACITY: usize = 256;

/// Shared broadcaster for engine events
#[derive(Clone)]
pub struct EventBroadcaster {
    sender: Arc<broadcast::Sender<String>>,
}

impl Default for EventBroadcaster {
    fn default() -> Self {
        Self::new()
    }
}

impl EventBroadcaster {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self {
            sender: Arc::new(sender),
        }
    }

    /// Send an event (JSON string) to all SSE subscribers.
    /// Silently ignores errors (no subscribers = no problem).
    pub fn send(&self, event_json: &str) {
        let _ = self.sender.send(event_json.to_string());
    }

    /// Create a new receiver for SSE consumption.
    #[allow(dead_code)] // Only used by the bridge feature
    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.sender.subscribe()
    }
}
