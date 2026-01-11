use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    pub page: i32,
    pub page_size: i32,
}

impl Default for Pagination {
    fn default() -> Self {
        Self {
            page: 1,
            page_size: 20,
        }
    }
}

impl Pagination {
    pub fn new(page: i32, page_size: i32) -> Self {
        Self {
            page: page.max(1),
            page_size: page_size.clamp(1, 100), // Limit page size to 100
        }
    }

    pub fn offset(&self) -> i64 {
        ((self.page - 1) * self.page_size) as i64
    }

    pub fn limit(&self) -> i64 {
        self.page_size as i64
    }

    /// Check if there are more pages
    pub fn has_more(&self, total_count: i64) -> bool {
        (self.page as i64) * (self.page_size as i64) < total_count
    }
}

/// Cursor-based pagination for feed endpoints
/// Requirements: 4.8
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CursorPagination {
    /// Cursor pointing to the last item of the previous page (typically a timestamp or ID)
    #[serde(default)]
    pub cursor: Option<String>,
    /// Number of items to return
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_limit() -> i32 {
    20
}

impl CursorPagination {
    pub fn new(cursor: Option<String>, limit: i32) -> Self {
        Self {
            cursor,
            limit: limit.clamp(1, 100),
        }
    }

    pub fn limit(&self) -> i64 {
        self.limit as i64
    }
}

/// Response with cursor-based pagination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPaginatedResponse<T> {
    pub data: Vec<T>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub pagination: PaginationMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationMeta {
    pub page: i32,
    pub page_size: i32,
    pub total_count: i64,
    pub total_pages: i32,
}

impl PaginationMeta {
    pub fn new(page: i32, page_size: i32, total_count: i64) -> Self {
        let total_pages = ((total_count as f64) / (page_size as f64)).ceil() as i32;
        Self {
            page,
            page_size,
            total_count,
            total_pages,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
        }
    }

    pub fn success_with_message(data: T, message: impl Into<String>) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: Some(message.into()),
        }
    }
}

impl ApiResponse<()> {
    pub fn ok() -> Self {
        Self {
            success: true,
            data: None,
            message: None,
        }
    }

    pub fn ok_with_message(message: impl Into<String>) -> Self {
        Self {
            success: true,
            data: None,
            message: Some(message.into()),
        }
    }
}
