//! Exchange expiration background task
//!
//! This module provides a background task that periodically processes
//! expired exchange requests and refunds coins to requesters.
//!
//! Requirements: 5.5

use std::sync::Arc;
use std::time::Duration;

use sqlx::PgPool;
use tokio::sync::watch;
use tokio::time::interval;

use crate::config::Config;
use crate::services::exchange_service::ExchangeService;

/// Default interval for checking expired requests (5 minutes)
const DEFAULT_CHECK_INTERVAL_SECS: u64 = 300;

/// Exchange expiration background task
///
/// This task runs periodically to:
/// 1. Find all pending exchange requests that have expired
/// 2. Refund coins to each requester
/// 3. Update the exchange request status to expired
pub struct ExchangeExpirationTask {
    exchange_service: Arc<ExchangeService>,
    check_interval: Duration,
}

impl ExchangeExpirationTask {
    /// Create a new ExchangeExpirationTask with default interval
    pub fn new(pool: PgPool, config: Config) -> Self {
        Self {
            exchange_service: Arc::new(ExchangeService::new(pool, config)),
            check_interval: Duration::from_secs(DEFAULT_CHECK_INTERVAL_SECS),
        }
    }

    /// Create a new ExchangeExpirationTask with custom interval
    pub fn with_interval(pool: PgPool, config: Config, interval_secs: u64) -> Self {
        Self {
            exchange_service: Arc::new(ExchangeService::new(pool, config)),
            check_interval: Duration::from_secs(interval_secs),
        }
    }

    /// Run the background task
    ///
    /// This method runs indefinitely, processing expired requests at regular intervals.
    /// It can be stopped by sending a signal through the shutdown receiver.
    pub async fn run(&self, mut shutdown_rx: watch::Receiver<bool>) {
        let mut ticker = interval(self.check_interval);
        
        tracing::info!(
            interval_secs = self.check_interval.as_secs(),
            "Starting exchange expiration background task"
        );

        loop {
            tokio::select! {
                _ = ticker.tick() => {
                    self.process_expired_requests().await;
                }
                _ = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        tracing::info!("Exchange expiration task received shutdown signal");
                        break;
                    }
                }
            }
        }

        tracing::info!("Exchange expiration background task stopped");
    }

    /// Process expired requests once
    ///
    /// This method can be called directly for testing or manual processing.
    pub async fn process_expired_requests(&self) {
        tracing::debug!("Checking for expired exchange requests");

        match self.exchange_service.process_expired_requests().await {
            Ok(result) => {
                if result.has_processed() {
                    tracing::info!(
                        total_found = result.total_found,
                        processed = result.processed_count,
                        failed = result.failed_count,
                        refunded_amount = result.total_refunded_amount,
                        "Processed expired exchange requests"
                    );
                } else if result.total_found > 0 {
                    tracing::warn!(
                        total_found = result.total_found,
                        failed = result.failed_count,
                        "Found expired requests but none were processed successfully"
                    );
                } else {
                    tracing::debug!("No expired exchange requests found");
                }
            }
            Err(e) => {
                tracing::error!(
                    error = %e,
                    "Failed to process expired exchange requests"
                );
            }
        }
    }
}

/// Spawn the exchange expiration background task
///
/// Returns a shutdown sender that can be used to stop the task gracefully.
pub fn spawn_exchange_expiration_task(
    pool: PgPool,
    config: Config,
) -> watch::Sender<bool> {
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let task = ExchangeExpirationTask::new(pool, config);

    tokio::spawn(async move {
        task.run(shutdown_rx).await;
    });

    shutdown_tx
}

/// Spawn the exchange expiration background task with custom interval
///
/// Returns a shutdown sender that can be used to stop the task gracefully.
pub fn spawn_exchange_expiration_task_with_interval(
    pool: PgPool,
    config: Config,
    interval_secs: u64,
) -> watch::Sender<bool> {
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let task = ExchangeExpirationTask::with_interval(pool, config, interval_secs);

    tokio::spawn(async move {
        task.run(shutdown_rx).await;
    });

    shutdown_tx
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_check_interval() {
        assert_eq!(DEFAULT_CHECK_INTERVAL_SECS, 300); // 5 minutes
    }
}
