//! Card handlers for CRUD, search, and social interactions
//!
//! Requirements: 3.1-3.10, 4.1-4.10, 7.1-7.8, 8.1-8.4

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::{AppState, AuthUserExtractor, OptionalAuthUserExtractor};
use crate::models::card::{
    CardCreateData, CardType, CardUpdateData, PrivacyLevel, SearchQuery, TimeRange,
};
use crate::models::common::{ApiResponse, CursorPagination, Pagination};
use crate::services::card_service::CardService;
use crate::services::recommendation_service::RecommendationService;

// Query Parameters
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_page")]
    pub page: i32,
    #[serde(default = "default_page_size")]
    pub page_size: i32,
}

fn default_page() -> i32 { 1 }
fn default_page_size() -> i32 { 20 }

impl From<PaginationQuery> for Pagination {
    fn from(query: PaginationQuery) -> Self {
        Pagination::new(query.page, query.page_size)
    }
}

#[derive(Debug, Deserialize)]
pub struct CursorPaginationQuery {
    pub cursor: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_limit() -> i32 { 20 }

impl From<CursorPaginationQuery> for CursorPagination {
    fn from(query: CursorPaginationQuery) -> Self {
        CursorPagination::new(query.cursor, query.limit)
    }
}

#[derive(Debug, Deserialize)]
pub struct SearchQueryParams {
    pub keyword: Option<String>,
    pub card_type: Option<CardType>,
    pub interest_tags: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub radius_km: Option<f64>,
    pub creator_id: Option<Uuid>,
    #[serde(default = "default_page")]
    pub page: i32,
    #[serde(default = "default_page_size")]
    pub page_size: i32,
}

impl SearchQueryParams {
    fn to_search_query(&self) -> SearchQuery {
        use crate::models::card::LocationFilter;
        let interest_tags = self.interest_tags.as_ref().map(|tags| {
            tags.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
        });
        let location = match (self.latitude, self.longitude, self.radius_km) {
            (Some(lat), Some(lon), Some(radius)) => Some(LocationFilter::new(lat, lon, radius)),
            _ => None,
        };
        SearchQuery {
            keyword: self.keyword.clone(),
            card_type: self.card_type.clone(),
            interest_tags,
            location,
            creator_id: self.creator_id,
        }
    }
    fn to_pagination(&self) -> Pagination {
        Pagination::new(self.page, self.page_size)
    }
}

#[derive(Debug, Deserialize)]
pub struct TimeRangeQuery {
    #[serde(default)]
    pub time_range: TimeRange,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

// Card CRUD Handlers

/// Create a new card - POST /api/cards
pub async fn create_card(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<CardCreateData>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let card = card_service.create_card(&auth.user_id, payload).await?;
    Ok((StatusCode::CREATED, Json(ApiResponse::success(card))))
}

/// Get a card by ID - GET /api/cards/:card_id
pub async fn get_card(
    State(state): State<AppState>,
    Path(card_id): Path<Uuid>,
    auth: OptionalAuthUserExtractor,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let viewer_id = auth.as_ref().map(|a| &a.user_id);
    let card = card_service.get_card(&card_id, viewer_id).await?
        .ok_or_else(|| AppError::NotFound("Card not found".to_string()))?;
    Ok(Json(ApiResponse::success(card)))
}

/// Update a card - PUT /api/cards/:card_id
pub async fn update_card(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(card_id): Path<Uuid>,
    Json(payload): Json<CardUpdateData>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let card = card_service.update_card(&card_id, &auth.user_id, payload).await?;
    Ok(Json(ApiResponse::success(card)))
}

/// Delete a card - DELETE /api/cards/:card_id
pub async fn delete_card(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(card_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    card_service.delete_card(&card_id, &auth.user_id).await?;
    Ok(Json(ApiResponse::<()>::ok_with_message("Card deleted successfully")))
}

// Card Discovery and Search Handlers

/// Get personalized feed - GET /api/cards/feed
pub async fn get_feed(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Query(query): Query<CursorPaginationQuery>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let feed = card_service.get_feed_with_cursor(&auth.user_id, query.cursor.as_deref(), query.limit as i64).await?;
    Ok(Json(ApiResponse::success(feed)))
}

/// Search cards - GET /api/cards/search
pub async fn search_cards(
    State(state): State<AppState>,
    auth: OptionalAuthUserExtractor,
    Query(query): Query<SearchQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let viewer_id = auth.as_ref().map(|a| &a.user_id);
    let result = card_service.search_cards(&query.to_search_query(), &query.to_pagination(), viewer_id).await?;
    Ok(Json(ApiResponse::success(result)))
}

/// Get hot cards - GET /api/cards/hot
pub async fn get_hot_cards(
    State(state): State<AppState>,
    auth: OptionalAuthUserExtractor,
    Query(query): Query<TimeRangeQuery>,
) -> Result<impl IntoResponse, AppError> {
    let recommendation_service = RecommendationService::new(state.pool.clone());
    let viewer_id = auth.as_ref().map(|a| &a.user_id);
    let cards = recommendation_service.get_hot_rankings(query.time_range, query.limit as usize, viewer_id).await?;
    Ok(Json(ApiResponse::success(cards)))
}

/// Get random cards - GET /api/cards/random
#[derive(Debug, Deserialize)]
pub struct RandomCardsQuery {
    #[serde(default = "default_random_count")]
    pub count: usize,
    pub exclude_ids: Option<String>,
}
fn default_random_count() -> usize { 10 }

pub async fn get_random_cards(
    State(state): State<AppState>,
    auth: OptionalAuthUserExtractor,
    Query(query): Query<RandomCardsQuery>,
) -> Result<impl IntoResponse, AppError> {
    let recommendation_service = RecommendationService::new(state.pool.clone());
    let exclude_ids: Vec<Uuid> = query.exclude_ids.as_ref()
        .map(|ids| ids.split(',').filter_map(|s| Uuid::parse_str(s.trim()).ok()).collect())
        .unwrap_or_default();
    let viewer_id = auth.as_ref().map(|a| &a.user_id);
    let cards = recommendation_service.get_random_cards(query.count, &exclude_ids, viewer_id).await?;
    Ok(Json(ApiResponse::success(cards)))
}

// User's Card Collection Handlers

/// Get my cards - GET /api/cards/my-cards
pub async fn get_my_cards(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let result = card_service.get_user_cards_paginated(&auth.user_id, &query.into(), Some(&auth.user_id)).await?;
    Ok(Json(ApiResponse::success(result)))
}

/// Get collected cards - GET /api/cards/collected
pub async fn get_collected_cards(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let result = card_service.get_collected_cards_paginated(&auth.user_id, &query.into()).await?;
    Ok(Json(ApiResponse::success(result)))
}

/// Get user's cards - GET /api/users/:user_id/cards
pub async fn get_user_cards(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    auth: OptionalAuthUserExtractor,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let viewer_id = auth.as_ref().map(|a| &a.user_id);
    let result = card_service.get_user_cards_paginated(&user_id, &query.into(), viewer_id).await?;
    Ok(Json(ApiResponse::success(result)))
}

/// Get timeline - GET /api/cards/timeline
pub async fn get_timeline(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let cards = card_service.get_cards_timeline(&auth.user_id).await?;
    Ok(Json(ApiResponse::success(cards)))
}

/// Get cards by category - GET /api/cards/by-category
pub async fn get_cards_by_category(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let categories = card_service.get_cards_by_category(&auth.user_id).await?;
    Ok(Json(ApiResponse::success(categories)))
}

// Folder Management Handlers

#[derive(Debug, Deserialize)]
pub struct CreateFolderRequest { pub name: String }

/// Create folder - POST /api/cards/folders
pub async fn create_folder(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<CreateFolderRequest>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let folder = card_service.create_folder(&auth.user_id, &payload.name).await?;
    Ok((StatusCode::CREATED, Json(ApiResponse::success(folder))))
}

/// Get folders - GET /api/cards/folders
pub async fn get_folders(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let folders = card_service.get_folders(&auth.user_id).await?;
    Ok(Json(ApiResponse::success(folders)))
}

/// Get folder cards - GET /api/cards/folders/:folder_id/cards
pub async fn get_folder_cards(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(folder_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let cards = card_service.get_cards_in_folder(&auth.user_id, &folder_id).await?;
    Ok(Json(ApiResponse::success(cards)))
}

#[derive(Debug, Deserialize)]
pub struct MoveToFolderRequest { pub folder_id: Option<Uuid> }

/// Move to folder - PUT /api/cards/:card_id/folder
pub async fn move_to_folder(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(card_id): Path<Uuid>,
    Json(payload): Json<MoveToFolderRequest>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    card_service.move_to_folder(&auth.user_id, &card_id, payload.folder_id.as_ref()).await?;
    Ok(Json(ApiResponse::<()>::ok_with_message("Card moved successfully")))
}

/// Delete folder - DELETE /api/cards/folders/:folder_id
pub async fn delete_folder(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(folder_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    card_service.delete_folder(&auth.user_id, &folder_id).await?;
    Ok(Json(ApiResponse::<()>::ok_with_message("Folder deleted successfully")))
}

#[derive(Debug, Deserialize)]
pub struct RenameFolderRequest { pub name: String }

/// Rename folder - PUT /api/cards/folders/:folder_id
pub async fn rename_folder(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(folder_id): Path<Uuid>,
    Json(payload): Json<RenameFolderRequest>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let folder = card_service.rename_folder(&auth.user_id, &folder_id, &payload.name).await?;
    Ok(Json(ApiResponse::success(folder)))
}

// Social Interaction Handlers

#[derive(Debug, Serialize)]
pub struct LikeResponse { pub like_count: i32 }

/// Like card - POST /api/cards/:card_id/like
pub async fn like_card(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(card_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let like_count = card_service.like_card(&card_id, &auth.user_id).await?;
    Ok(Json(ApiResponse::success(LikeResponse { like_count })))
}

/// Unlike card - DELETE /api/cards/:card_id/like
pub async fn unlike_card(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(card_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let like_count = card_service.unlike_card(&card_id, &auth.user_id).await?;
    Ok(Json(ApiResponse::success(LikeResponse { like_count })))
}

#[derive(Debug, Deserialize)]
pub struct AddCommentRequest { pub content: String }

/// Add comment - POST /api/cards/:card_id/comments
pub async fn add_comment(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(card_id): Path<Uuid>,
    Json(payload): Json<AddCommentRequest>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let comment = card_service.add_comment(&card_id, &auth.user_id, &payload.content).await?;
    Ok((StatusCode::CREATED, Json(ApiResponse::success(comment))))
}

/// Get comments - GET /api/cards/:card_id/comments
pub async fn get_comments(
    State(state): State<AppState>,
    Path(card_id): Path<Uuid>,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let comments = card_service.get_comments(&card_id, &query.into()).await?;
    Ok(Json(ApiResponse::success(comments)))
}

/// Delete comment - DELETE /api/cards/comments/:comment_id
pub async fn delete_comment(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(comment_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    card_service.delete_comment(&comment_id, &auth.user_id).await?;
    Ok(Json(ApiResponse::<()>::ok_with_message("Comment deleted successfully")))
}

// Privacy Management

#[derive(Debug, Deserialize)]
pub struct UpdatePrivacyRequest { pub privacy_level: PrivacyLevel }

#[derive(Debug, Serialize)]
pub struct PrivacyResponse { pub privacy_level: PrivacyLevel }

/// Update privacy - PUT /api/cards/:card_id/privacy
pub async fn update_privacy(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(card_id): Path<Uuid>,
    Json(payload): Json<UpdatePrivacyRequest>,
) -> Result<impl IntoResponse, AppError> {
    let card_service = CardService::new(state.pool.clone(), state.config.clone());
    let privacy_level = card_service.update_privacy_level(&card_id, &auth.user_id, payload.privacy_level).await?;
    Ok(Json(ApiResponse::success(PrivacyResponse { privacy_level })))
}
