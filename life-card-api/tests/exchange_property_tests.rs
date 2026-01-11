//! Property-based tests for exchange module
//!
//! These tests validate the correctness properties defined in the design document.
//!
//! **Feature: life-card-mvp**

use proptest::prelude::*;
use uuid::Uuid;
use std::collections::{HashMap, HashSet};

// ============================================================================
// Generators for test data
// ============================================================================

/// Generate a random UUID
fn uuid_strategy() -> impl Strategy<Value = Uuid> {
    any::<[u8; 16]>().prop_map(|bytes| Uuid::from_bytes(bytes))
}

/// Generate a valid coin amount (positive, reasonable range)
fn coin_amount_strategy() -> impl Strategy<Value = i32> {
    1i32..100i32
}

/// Generate a valid initial balance (enough for exchanges)
fn initial_balance_strategy() -> impl Strategy<Value = i32> {
    100i32..1000i32
}

// ============================================================================
// Property 10: Exchange Flow Integrity
// **Validates: Requirements 5.1, 5.3, 5.4, 5.5**
//
// For any exchange request flow (create → accept/reject/expire), THE
// Exchange_Service SHALL maintain the following invariants:
// - Requester's coins are deducted on request creation
// - Coins are refunded on rejection or expiration
// - Card access is granted only on acceptance
// - Owner receives coins only on acceptance
// - Total coins in the system remain constant (conservation)
// ============================================================================

/// Exchange status for the model
#[derive(Debug, Clone, PartialEq)]
enum ExchangeStatus {
    Pending,
    Accepted,
    Rejected,
    Cancelled,
    Expired,
}

/// Exchange request in the model
#[derive(Debug, Clone)]
struct ExchangeRequestModel {
    id: Uuid,
    requester_id: Uuid,
    card_id: Uuid,
    owner_id: Uuid,
    coin_amount: i32,
    status: ExchangeStatus,
}

/// A simple in-memory model of the exchange system for property testing
/// This models the expected behavior without database interaction
#[derive(Debug, Clone)]
struct ExchangeSystemModel {
    /// User balances: user_id -> coin_balance
    balances: HashMap<Uuid, i32>,
    /// Cards: card_id -> (owner_id, base_price)
    cards: HashMap<Uuid, (Uuid, i32)>,
    /// Exchange requests
    requests: HashMap<Uuid, ExchangeRequestModel>,
    /// Card collections: user_id -> set of card_ids they have access to
    collections: HashMap<Uuid, HashSet<Uuid>>,
    /// Total coins in the system (for conservation check)
    total_coins: i64,
    /// Coins held in escrow for pending exchanges
    escrowed_coins: i64,
}

impl ExchangeSystemModel {
    fn new() -> Self {
        Self {
            balances: HashMap::new(),
            cards: HashMap::new(),
            requests: HashMap::new(),
            collections: HashMap::new(),
            total_coins: 0,
            escrowed_coins: 0,
        }
    }

    /// Add a user with initial balance
    fn add_user(&mut self, user_id: Uuid, initial_balance: i32) {
        self.balances.insert(user_id, initial_balance);
        self.collections.insert(user_id, HashSet::new());
        self.total_coins += initial_balance as i64;
    }

    /// Add a card owned by a user
    fn add_card(&mut self, card_id: Uuid, owner_id: Uuid, base_price: i32) {
        self.cards.insert(card_id, (owner_id, base_price));
        // Owner has access to their own card
        self.collections.entry(owner_id).or_default().insert(card_id);
    }

    /// Get user balance
    fn get_balance(&self, user_id: &Uuid) -> Option<i32> {
        self.balances.get(user_id).copied()
    }

    /// Check if user has access to a card
    fn has_card_access(&self, user_id: &Uuid, card_id: &Uuid) -> bool {
        self.collections.get(user_id).map_or(false, |cards| cards.contains(card_id))
    }

    /// Calculate total coins in the system (including escrowed)
    fn calculate_total_coins(&self) -> i64 {
        let user_balances: i64 = self.balances.values().map(|&b| b as i64).sum();
        user_balances + self.escrowed_coins
    }

    /// Verify coin conservation invariant
    fn verify_coin_conservation(&self) -> bool {
        self.calculate_total_coins() == self.total_coins
    }

    /// Create an exchange request
    /// Requirements: 5.1, 5.2
    fn create_exchange_request(
        &mut self,
        requester_id: Uuid,
        card_id: Uuid,
    ) -> Result<Uuid, String> {
        // 1. Validate card exists
        let (owner_id, base_price) = self.cards.get(&card_id)
            .ok_or_else(|| "Card not found".to_string())?
            .clone();

        // 2. Validate requester is not the owner
        if requester_id == owner_id {
            return Err("Cannot exchange your own card".to_string());
        }

        // 3. Validate requester exists
        let requester_balance = self.balances.get(&requester_id)
            .ok_or_else(|| "Requester not found".to_string())?;

        // 4. Validate requester has sufficient balance
        if *requester_balance < base_price {
            return Err(format!(
                "Insufficient balance. Required: {}, Available: {}",
                base_price, requester_balance
            ));
        }

        // 5. Check if requester already has this card
        if self.has_card_access(&requester_id, &card_id) {
            return Err("You already have access to this card".to_string());
        }

        // 6. Deduct coins from requester and put in escrow
        *self.balances.get_mut(&requester_id).unwrap() -= base_price;
        self.escrowed_coins += base_price as i64;

        // 7. Create the exchange request
        let exchange_id = Uuid::new_v4();
        let request = ExchangeRequestModel {
            id: exchange_id,
            requester_id,
            card_id,
            owner_id,
            coin_amount: base_price,
            status: ExchangeStatus::Pending,
        };
        self.requests.insert(exchange_id, request);

        Ok(exchange_id)
    }

    /// Accept an exchange request
    /// Requirements: 5.3
    fn accept_exchange(
        &mut self,
        exchange_id: &Uuid,
        owner_id: &Uuid,
    ) -> Result<(), String> {
        // 1. Get the exchange request
        let request = self.requests.get(exchange_id)
            .ok_or_else(|| "Exchange request not found".to_string())?
            .clone();

        // 2. Validate caller is the owner
        if request.owner_id != *owner_id {
            return Err("Only the card owner can accept this exchange".to_string());
        }

        // 3. Validate request is pending
        if request.status != ExchangeStatus::Pending {
            return Err(format!("Cannot accept exchange with status: {:?}", request.status));
        }

        // 4. Transfer coins from escrow to owner
        self.escrowed_coins -= request.coin_amount as i64;
        *self.balances.get_mut(owner_id).unwrap() += request.coin_amount;

        // 5. Grant card access to requester
        self.collections
            .entry(request.requester_id)
            .or_default()
            .insert(request.card_id);

        // 6. Update request status
        self.requests.get_mut(exchange_id).unwrap().status = ExchangeStatus::Accepted;

        Ok(())
    }

    /// Reject an exchange request
    /// Requirements: 5.4
    fn reject_exchange(
        &mut self,
        exchange_id: &Uuid,
        owner_id: &Uuid,
    ) -> Result<(), String> {
        // 1. Get the exchange request
        let request = self.requests.get(exchange_id)
            .ok_or_else(|| "Exchange request not found".to_string())?
            .clone();

        // 2. Validate caller is the owner
        if request.owner_id != *owner_id {
            return Err("Only the card owner can reject this exchange".to_string());
        }

        // 3. Validate request is pending
        if request.status != ExchangeStatus::Pending {
            return Err(format!("Cannot reject exchange with status: {:?}", request.status));
        }

        // 4. Refund coins from escrow to requester
        self.escrowed_coins -= request.coin_amount as i64;
        *self.balances.get_mut(&request.requester_id).unwrap() += request.coin_amount;

        // 5. Update request status
        self.requests.get_mut(exchange_id).unwrap().status = ExchangeStatus::Rejected;

        Ok(())
    }

    /// Cancel an exchange request (by requester)
    fn cancel_exchange(
        &mut self,
        exchange_id: &Uuid,
        requester_id: &Uuid,
    ) -> Result<(), String> {
        // 1. Get the exchange request
        let request = self.requests.get(exchange_id)
            .ok_or_else(|| "Exchange request not found".to_string())?
            .clone();

        // 2. Validate caller is the requester
        if request.requester_id != *requester_id {
            return Err("Only the requester can cancel this exchange".to_string());
        }

        // 3. Validate request is pending
        if request.status != ExchangeStatus::Pending {
            return Err(format!("Cannot cancel exchange with status: {:?}", request.status));
        }

        // 4. Refund coins from escrow to requester
        self.escrowed_coins -= request.coin_amount as i64;
        *self.balances.get_mut(requester_id).unwrap() += request.coin_amount;

        // 5. Update request status
        self.requests.get_mut(exchange_id).unwrap().status = ExchangeStatus::Cancelled;

        Ok(())
    }

    /// Expire an exchange request
    /// Requirements: 5.5
    fn expire_exchange(&mut self, exchange_id: &Uuid) -> Result<(), String> {
        // 1. Get the exchange request
        let request = self.requests.get(exchange_id)
            .ok_or_else(|| "Exchange request not found".to_string())?
            .clone();

        // 2. Validate request is pending
        if request.status != ExchangeStatus::Pending {
            return Err(format!("Cannot expire exchange with status: {:?}", request.status));
        }

        // 3. Refund coins from escrow to requester
        self.escrowed_coins -= request.coin_amount as i64;
        *self.balances.get_mut(&request.requester_id).unwrap() += request.coin_amount;

        // 4. Update request status
        self.requests.get_mut(exchange_id).unwrap().status = ExchangeStatus::Expired;

        Ok(())
    }

    /// Get exchange request status
    fn get_request_status(&self, exchange_id: &Uuid) -> Option<ExchangeStatus> {
        self.requests.get(exchange_id).map(|r| r.status.clone())
    }
}


// ============================================================================
// Property Tests for Exchange Flow Integrity
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Coins Deducted on Request**
    ///
    /// For any exchange request creation, the requester's coins should be
    /// deducted by the exchange price amount.
    #[test]
    fn prop_coins_deducted_on_request_creation(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        card_id in uuid_strategy(),
        initial_balance in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(initial_balance >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, initial_balance);
        model.add_user(owner_id, 100);
        model.add_card(card_id, owner_id, card_price);

        let balance_before = model.get_balance(&requester_id).unwrap();

        // Create exchange request
        let result = model.create_exchange_request(requester_id, card_id);
        prop_assert!(result.is_ok(), "Exchange request should succeed");

        let balance_after = model.get_balance(&requester_id).unwrap();

        // Verify coins were deducted
        prop_assert_eq!(
            balance_after,
            balance_before - card_price,
            "Requester's balance should be reduced by card price"
        );

        // Verify coin conservation
        prop_assert!(
            model.verify_coin_conservation(),
            "Total coins in system should remain constant"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Coins Refunded on Rejection**
    ///
    /// For any rejected exchange request, the requester's coins should be
    /// refunded to their original balance.
    #[test]
    fn prop_coins_refunded_on_rejection(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        card_id in uuid_strategy(),
        initial_balance in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(initial_balance >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, initial_balance);
        model.add_user(owner_id, 100);
        model.add_card(card_id, owner_id, card_price);

        // Create exchange request
        let exchange_id = model.create_exchange_request(requester_id, card_id)
            .expect("Exchange request should succeed");

        // Reject the exchange
        model.reject_exchange(&exchange_id, &owner_id)
            .expect("Rejection should succeed");

        let balance_after = model.get_balance(&requester_id).unwrap();

        // Verify coins were refunded
        prop_assert_eq!(
            balance_after,
            initial_balance,
            "Requester's balance should be restored after rejection"
        );

        // Verify coin conservation
        prop_assert!(
            model.verify_coin_conservation(),
            "Total coins in system should remain constant"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Coins Refunded on Expiration**
    ///
    /// For any expired exchange request, the requester's coins should be
    /// refunded to their original balance.
    #[test]
    fn prop_coins_refunded_on_expiration(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        card_id in uuid_strategy(),
        initial_balance in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(initial_balance >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, initial_balance);
        model.add_user(owner_id, 100);
        model.add_card(card_id, owner_id, card_price);

        // Create exchange request
        let exchange_id = model.create_exchange_request(requester_id, card_id)
            .expect("Exchange request should succeed");

        // Expire the exchange
        model.expire_exchange(&exchange_id)
            .expect("Expiration should succeed");

        let balance_after = model.get_balance(&requester_id).unwrap();

        // Verify coins were refunded
        prop_assert_eq!(
            balance_after,
            initial_balance,
            "Requester's balance should be restored after expiration"
        );

        // Verify coin conservation
        prop_assert!(
            model.verify_coin_conservation(),
            "Total coins in system should remain constant"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Coins Refunded on Cancellation**
    ///
    /// For any cancelled exchange request, the requester's coins should be
    /// refunded to their original balance.
    #[test]
    fn prop_coins_refunded_on_cancellation(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        card_id in uuid_strategy(),
        initial_balance in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(initial_balance >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, initial_balance);
        model.add_user(owner_id, 100);
        model.add_card(card_id, owner_id, card_price);

        // Create exchange request
        let exchange_id = model.create_exchange_request(requester_id, card_id)
            .expect("Exchange request should succeed");

        // Cancel the exchange
        model.cancel_exchange(&exchange_id, &requester_id)
            .expect("Cancellation should succeed");

        let balance_after = model.get_balance(&requester_id).unwrap();

        // Verify coins were refunded
        prop_assert_eq!(
            balance_after,
            initial_balance,
            "Requester's balance should be restored after cancellation"
        );

        // Verify coin conservation
        prop_assert!(
            model.verify_coin_conservation(),
            "Total coins in system should remain constant"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Card Access on Acceptance**
    ///
    /// For any accepted exchange request, the requester should gain access
    /// to the card, and the owner should receive the coins.
    #[test]
    fn prop_card_access_granted_on_acceptance(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        card_id in uuid_strategy(),
        requester_initial in initial_balance_strategy(),
        owner_initial in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(requester_initial >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, requester_initial);
        model.add_user(owner_id, owner_initial);
        model.add_card(card_id, owner_id, card_price);

        // Requester should not have card access initially
        prop_assert!(
            !model.has_card_access(&requester_id, &card_id),
            "Requester should not have card access before exchange"
        );

        // Create exchange request
        let exchange_id = model.create_exchange_request(requester_id, card_id)
            .expect("Exchange request should succeed");

        // Requester still should not have card access (pending)
        prop_assert!(
            !model.has_card_access(&requester_id, &card_id),
            "Requester should not have card access while pending"
        );

        // Accept the exchange
        model.accept_exchange(&exchange_id, &owner_id)
            .expect("Acceptance should succeed");

        // Requester should now have card access
        prop_assert!(
            model.has_card_access(&requester_id, &card_id),
            "Requester should have card access after acceptance"
        );

        // Verify coin conservation
        prop_assert!(
            model.verify_coin_conservation(),
            "Total coins in system should remain constant"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Owner Receives Coins on Acceptance**
    ///
    /// For any accepted exchange request, the owner should receive the
    /// exchange price in coins.
    #[test]
    fn prop_owner_receives_coins_on_acceptance(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        card_id in uuid_strategy(),
        requester_initial in initial_balance_strategy(),
        owner_initial in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(requester_initial >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, requester_initial);
        model.add_user(owner_id, owner_initial);
        model.add_card(card_id, owner_id, card_price);

        // Create exchange request
        let exchange_id = model.create_exchange_request(requester_id, card_id)
            .expect("Exchange request should succeed");

        // Owner balance should not change yet
        prop_assert_eq!(
            model.get_balance(&owner_id).unwrap(),
            owner_initial,
            "Owner balance should not change while pending"
        );

        // Accept the exchange
        model.accept_exchange(&exchange_id, &owner_id)
            .expect("Acceptance should succeed");

        // Owner should receive coins
        prop_assert_eq!(
            model.get_balance(&owner_id).unwrap(),
            owner_initial + card_price,
            "Owner should receive card price after acceptance"
        );

        // Verify coin conservation
        prop_assert!(
            model.verify_coin_conservation(),
            "Total coins in system should remain constant"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - No Card Access on Rejection**
    ///
    /// For any rejected exchange request, the requester should NOT gain
    /// access to the card.
    #[test]
    fn prop_no_card_access_on_rejection(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        card_id in uuid_strategy(),
        initial_balance in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(initial_balance >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, initial_balance);
        model.add_user(owner_id, 100);
        model.add_card(card_id, owner_id, card_price);

        // Create exchange request
        let exchange_id = model.create_exchange_request(requester_id, card_id)
            .expect("Exchange request should succeed");

        // Reject the exchange
        model.reject_exchange(&exchange_id, &owner_id)
            .expect("Rejection should succeed");

        // Requester should NOT have card access
        prop_assert!(
            !model.has_card_access(&requester_id, &card_id),
            "Requester should not have card access after rejection"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Coin Conservation**
    ///
    /// For any sequence of exchange operations, the total coins in the system
    /// should remain constant.
    #[test]
    fn prop_coin_conservation_through_exchange_flow(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        card_id in uuid_strategy(),
        requester_initial in initial_balance_strategy(),
        owner_initial in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(requester_initial >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, requester_initial);
        model.add_user(owner_id, owner_initial);
        model.add_card(card_id, owner_id, card_price);

        let initial_total = model.calculate_total_coins();

        // Create exchange request
        let exchange_id = model.create_exchange_request(requester_id, card_id)
            .expect("Exchange request should succeed");

        // Verify conservation after creation
        prop_assert_eq!(
            model.calculate_total_coins(),
            initial_total,
            "Total coins should be conserved after request creation"
        );

        // Accept the exchange
        model.accept_exchange(&exchange_id, &owner_id)
            .expect("Acceptance should succeed");

        // Verify conservation after acceptance
        prop_assert_eq!(
            model.calculate_total_coins(),
            initial_total,
            "Total coins should be conserved after acceptance"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Insufficient Balance Rejected**
    ///
    /// Exchange requests with insufficient balance should be rejected without
    /// modifying any state.
    #[test]
    fn prop_insufficient_balance_rejected(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        card_id in uuid_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);

        let mut model = ExchangeSystemModel::new();
        // Give requester less than card price
        let insufficient_balance = card_price - 1;
        model.add_user(requester_id, insufficient_balance.max(0));
        model.add_user(owner_id, 100);
        model.add_card(card_id, owner_id, card_price);

        let balance_before = model.get_balance(&requester_id).unwrap();

        // Attempt exchange request
        let result = model.create_exchange_request(requester_id, card_id);

        // Should fail
        prop_assert!(result.is_err(), "Exchange should fail with insufficient balance");

        // Balance should not change
        prop_assert_eq!(
            model.get_balance(&requester_id).unwrap(),
            balance_before,
            "Balance should not change on failed request"
        );

        // Verify coin conservation
        prop_assert!(
            model.verify_coin_conservation(),
            "Total coins should be conserved on failed request"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Cannot Exchange Own Card**
    ///
    /// Users cannot create exchange requests for their own cards.
    #[test]
    fn prop_cannot_exchange_own_card(
        user_id in uuid_strategy(),
        card_id in uuid_strategy(),
        initial_balance in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        let mut model = ExchangeSystemModel::new();
        model.add_user(user_id, initial_balance);
        model.add_card(card_id, user_id, card_price);

        let balance_before = model.get_balance(&user_id).unwrap();

        // Attempt to exchange own card
        let result = model.create_exchange_request(user_id, card_id);

        // Should fail
        prop_assert!(result.is_err(), "Should not be able to exchange own card");

        // Balance should not change
        prop_assert_eq!(
            model.get_balance(&user_id).unwrap(),
            balance_before,
            "Balance should not change when trying to exchange own card"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Only Owner Can Accept**
    ///
    /// Only the card owner can accept an exchange request.
    #[test]
    fn prop_only_owner_can_accept(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        other_user_id in uuid_strategy(),
        card_id in uuid_strategy(),
        initial_balance in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(other_user_id != owner_id);
        prop_assume!(other_user_id != requester_id);
        prop_assume!(initial_balance >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, initial_balance);
        model.add_user(owner_id, 100);
        model.add_user(other_user_id, 100);
        model.add_card(card_id, owner_id, card_price);

        // Create exchange request
        let exchange_id = model.create_exchange_request(requester_id, card_id)
            .expect("Exchange request should succeed");

        // Other user tries to accept
        let result = model.accept_exchange(&exchange_id, &other_user_id);
        prop_assert!(result.is_err(), "Non-owner should not be able to accept");

        // Requester tries to accept
        let result = model.accept_exchange(&exchange_id, &requester_id);
        prop_assert!(result.is_err(), "Requester should not be able to accept");

        // Request should still be pending
        prop_assert_eq!(
            model.get_request_status(&exchange_id),
            Some(ExchangeStatus::Pending),
            "Request should still be pending"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Only Owner Can Reject**
    ///
    /// Only the card owner can reject an exchange request.
    #[test]
    fn prop_only_owner_can_reject(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        other_user_id in uuid_strategy(),
        card_id in uuid_strategy(),
        initial_balance in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(other_user_id != owner_id);
        prop_assume!(other_user_id != requester_id);
        prop_assume!(initial_balance >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, initial_balance);
        model.add_user(owner_id, 100);
        model.add_user(other_user_id, 100);
        model.add_card(card_id, owner_id, card_price);

        // Create exchange request
        let exchange_id = model.create_exchange_request(requester_id, card_id)
            .expect("Exchange request should succeed");

        // Other user tries to reject
        let result = model.reject_exchange(&exchange_id, &other_user_id);
        prop_assert!(result.is_err(), "Non-owner should not be able to reject");

        // Request should still be pending
        prop_assert_eq!(
            model.get_request_status(&exchange_id),
            Some(ExchangeStatus::Pending),
            "Request should still be pending"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Only Requester Can Cancel**
    ///
    /// Only the requester can cancel an exchange request.
    #[test]
    fn prop_only_requester_can_cancel(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        other_user_id in uuid_strategy(),
        card_id in uuid_strategy(),
        initial_balance in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(other_user_id != owner_id);
        prop_assume!(other_user_id != requester_id);
        prop_assume!(initial_balance >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, initial_balance);
        model.add_user(owner_id, 100);
        model.add_user(other_user_id, 100);
        model.add_card(card_id, owner_id, card_price);

        // Create exchange request
        let exchange_id = model.create_exchange_request(requester_id, card_id)
            .expect("Exchange request should succeed");

        // Other user tries to cancel
        let result = model.cancel_exchange(&exchange_id, &other_user_id);
        prop_assert!(result.is_err(), "Non-requester should not be able to cancel");

        // Owner tries to cancel
        let result = model.cancel_exchange(&exchange_id, &owner_id);
        prop_assert!(result.is_err(), "Owner should not be able to cancel");

        // Request should still be pending
        prop_assert_eq!(
            model.get_request_status(&exchange_id),
            Some(ExchangeStatus::Pending),
            "Request should still be pending"
        );
    }

    /// **Feature: life-card-mvp, Property 10: Exchange Flow Integrity - Terminal States Are Final**
    ///
    /// Once an exchange request reaches a terminal state (accepted, rejected,
    /// cancelled, expired), no further state transitions should be possible.
    #[test]
    fn prop_terminal_states_are_final(
        requester_id in uuid_strategy(),
        owner_id in uuid_strategy(),
        card_id in uuid_strategy(),
        initial_balance in initial_balance_strategy(),
        card_price in coin_amount_strategy(),
    ) {
        prop_assume!(requester_id != owner_id);
        prop_assume!(initial_balance >= card_price);

        let mut model = ExchangeSystemModel::new();
        model.add_user(requester_id, initial_balance);
        model.add_user(owner_id, 100);
        model.add_card(card_id, owner_id, card_price);

        // Create and accept exchange request
        let exchange_id = model.create_exchange_request(requester_id, card_id)
            .expect("Exchange request should succeed");
        model.accept_exchange(&exchange_id, &owner_id)
            .expect("Acceptance should succeed");

        // Try to reject after acceptance
        let result = model.reject_exchange(&exchange_id, &owner_id);
        prop_assert!(result.is_err(), "Cannot reject after acceptance");

        // Try to cancel after acceptance
        let result = model.cancel_exchange(&exchange_id, &requester_id);
        prop_assert!(result.is_err(), "Cannot cancel after acceptance");

        // Try to expire after acceptance
        let result = model.expire_exchange(&exchange_id);
        prop_assert!(result.is_err(), "Cannot expire after acceptance");

        // Try to accept again
        let result = model.accept_exchange(&exchange_id, &owner_id);
        prop_assert!(result.is_err(), "Cannot accept twice");
    }
}
