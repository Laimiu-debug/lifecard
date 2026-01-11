//! Upload handlers - Local file storage for development
//!
//! Requirements: 3.4, 2.6

use axum::{
    extract::{Multipart, State},
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use std::path::Path;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::{AppState, AuthUserExtractor};
use crate::models::common::ApiResponse;

/// Upload result
#[derive(Debug, Serialize)]
pub struct UploadResult {
    pub url: String,
    pub file_id: String,
    pub thumbnail_url: Option<String>,
}

/// Get file extension from filename
fn get_extension(filename: &str) -> String {
    Path::new(filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("jpg")
        .to_lowercase()
}

/// Ensure upload directory exists
async fn ensure_upload_dir(dir: &str) -> Result<(), AppError> {
    fs::create_dir_all(dir).await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to create upload directory: {}", e))
    })
}

/// Upload avatar - POST /api/upload/avatar
pub async fn upload_avatar(
    State(state): State<AppState>,
    _auth: AuthUserExtractor,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    let upload_dir = "uploads/avatars";
    ensure_upload_dir(upload_dir).await?;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::Validation(format!("Failed to read multipart field: {}", e))
    })? {
        let filename = field.file_name().unwrap_or("avatar.jpg").to_string();
        let ext = get_extension(&filename);
        let data = field.bytes().await.map_err(|e| {
            AppError::Validation(format!("Failed to read field data: {}", e))
        })?;

        // Generate unique file ID
        let file_id = Uuid::new_v4().to_string();
        let new_filename = format!("{}.{}", file_id, ext);
        let file_path = format!("{}/{}", upload_dir, new_filename);

        // Write file to disk
        let mut file = fs::File::create(&file_path).await.map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Failed to create file: {}", e))
        })?;
        file.write_all(&data).await.map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Failed to write file: {}", e))
        })?;

        // Build URL (relative to API server)
        // Use localhost instead of 0.0.0.0 for accessible URL
        let host = if state.config.app_host == "0.0.0.0" {
            "localhost"
        } else {
            &state.config.app_host
        };
        let base_url = format!("http://{}:{}", host, state.config.app_port);
        let url = format!("{}/uploads/avatars/{}", base_url, new_filename);

        return Ok(Json(ApiResponse::success(UploadResult {
            url,
            file_id,
            thumbnail_url: None,
        })));
    }

    Err(AppError::Validation("No file provided".to_string()))
}

/// Upload card media - POST /api/upload/card_media
pub async fn upload_card_media(
    State(state): State<AppState>,
    _auth: AuthUserExtractor,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    let upload_dir = "uploads/media";
    ensure_upload_dir(upload_dir).await?;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::Validation(format!("Failed to read multipart field: {}", e))
    })? {
        let filename = field.file_name().unwrap_or("media.jpg").to_string();
        let ext = get_extension(&filename);
        let data = field.bytes().await.map_err(|e| {
            AppError::Validation(format!("Failed to read field data: {}", e))
        })?;

        // Generate unique file ID
        let file_id = Uuid::new_v4().to_string();
        let new_filename = format!("{}.{}", file_id, ext);
        let file_path = format!("{}/{}", upload_dir, new_filename);

        // Write file to disk
        let mut file = fs::File::create(&file_path).await.map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Failed to create file: {}", e))
        })?;
        file.write_all(&data).await.map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Failed to write file: {}", e))
        })?;

        // Build URL
        // Use localhost instead of 0.0.0.0 for accessible URL
        let host = if state.config.app_host == "0.0.0.0" {
            "localhost"
        } else {
            &state.config.app_host
        };
        let base_url = format!("http://{}:{}", host, state.config.app_port);
        let url = format!("{}/uploads/media/{}", base_url, new_filename);
        let thumbnail_url = url.clone(); // For simplicity, use same URL as thumbnail

        return Ok(Json(ApiResponse::success(UploadResult {
            url,
            file_id,
            thumbnail_url: Some(thumbnail_url),
        })));
    }

    Err(AppError::Validation("No file provided".to_string()))
}
