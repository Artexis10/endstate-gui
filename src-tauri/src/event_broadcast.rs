//! Event broadcast channel for dev-mode HTTP bridge.
//!
//! Provides a wrapper around tokio::sync::broadcast that allows
//! engine events to be consumed by both Tauri's event system
//! and the SSE endpoint simultaneously.

use std::sync::Arc;
use tokio::sync::broadcast;

/// Capacity of the broadcast channel (number of events to buffer)
const BROADCAST_CAPACITY: usize = 256;

/// Shared broadcaster for engine events
#[derive(Clone)]
pub struct EventBroadcaster {
    sender: Arc<broadcast::Sender<String>>,
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
    pub fn subscribe(&self) -> broadcast::Receiver<String> {
        self.sender.subscribe()
    }
}
