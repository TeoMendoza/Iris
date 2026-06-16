use spacetimedb::{Identity, SpacetimeType, Timestamp, table};

#[table(accessor = company, public)]
pub struct Company {
    #[primary_key] #[auto_inc] pub id: u64,
    #[unique] pub code: String,
    #[unique] pub vision_key: String,
    pub name: String,
}

#[table(accessor = user, public)]
pub struct User {
    #[primary_key] pub id: Identity,
    pub name: String,
    pub email: String,
}

#[table(accessor = employee, public, index(accessor = company_employees, btree(columns = [company_id])))]
pub struct Employee {
    #[primary_key] pub id: Identity,
    pub company_id: u64,
}

#[table(accessor = vision_client)]
pub struct VisionClient {
    #[primary_key] pub identity: Identity,
}

#[table(accessor = pending_photo, public)]
pub struct PendingPhoto {
    #[primary_key] #[auto_inc] pub id: u64,
    pub image_bytes: Vec<u8>,
}

#[table(accessor = claimed_photo, public)]
pub struct ClaimedPhoto {
    #[primary_key] #[auto_inc] pub id: u64,
    pub image_bytes: Vec<u8>,
    pub claimed_at: Timestamp,
    pub claimed_by: Identity,
}

#[table(accessor = review_item, public, index(accessor = review_items_by_company, btree(columns = [company_id])))]
pub struct ReviewItem {
    #[primary_key] #[auto_inc] pub id: u64,
    pub scan_id: u64,
    pub company_id: u64,
    pub image_bytes: Vec<u8>,
    pub predicted_category: Category,
    pub predicted_count: u32,
    pub predicted_total_value: f64,
}

#[table(accessor = inventory_category, public, index(accessor = inv_categories_by_company, btree(columns = [company_id])))]
pub struct InventoryCategory {
    #[primary_key] #[auto_inc] pub id: u64,
    pub company_id: u64,
    #[unique] pub category: Category,
    pub shelf_count: u32,
    pub storage_count: u32,
    pub sold_count: u32,
    pub total_value: f64,
    pub category_image_bytes: Vec<u8>,
}

#[table(accessor = stock_entry, public,
    index(accessor = stock_entries_by_company, btree(columns = [company_id])),
    index(accessor = stock_entries_by_confirmer, btree(columns = [confirmed_by])))]
pub struct StockEntry {
    #[primary_key] #[auto_inc] pub id: u64,
    pub company_id: u64,
    pub category: Category,
    pub items_added: u32,
    pub value_at_scan: f64,
    pub scanned_at: Timestamp,
    pub confirmed_by: Identity,
}

#[table(accessor = prediction_log,
    index(accessor = prediction_logs_by_company, btree(columns = [company_id])))]
pub struct PredictionLog {
    #[primary_key] #[auto_inc] pub id: u64,
    pub company_id: u64,
    pub predicted_category: Category,
    pub predicted_count: u32,
    pub predicted_total_value: f64,
    pub confirmed_category: Category,
    pub confirmed_count: u32,
    pub confirmed_total_value: f64,
    pub was_rejected: bool,
}

// ── Enums ──────────────────────────────────────────────────

#[derive(SpacetimeType, Clone, PartialEq)]
pub enum Category {
    Clothing,
    Footwear,
    Electronics,
    Furniture,
    Food,
    Books,
    Tools,
    Toys,
    Misc,
}

#[derive(SpacetimeType, Clone, PartialEq)]
pub enum Status {
    Sold,
    Shelf,
    Storage,
}

#[derive(SpacetimeType, Clone)]
pub struct DetectionInput {
    pub category: Category,
    pub count: u32,
    pub total_value: f64,
}

// ── Analytics types ────────────────────────────────────────

#[derive(SpacetimeType)]
pub struct AnalyticsOverview {
    pub total_employees: u32,
    pub pending_review: u32,
    pub active_categories: u32,
    pub shelf_count: u32,
    pub storage_count: u32,
    pub sold_count: u32,
    pub shelf_value: f64,
    pub storage_value: f64,
    pub sold_value: f64,
}

#[derive(SpacetimeType)]
pub struct CategoryDetail {
    pub shelf_count: u32,
    pub storage_count: u32,
    pub sold_count: u32,
    pub total_value: f64,
    pub avg_item_value: f64,
    pub sell_through_rate: f64,
    pub value_pct: f64,
}

#[derive(SpacetimeType)]
pub struct CategoryBreakdown {
    pub clothing: CategoryDetail,
    pub footwear: CategoryDetail,
    pub electronics: CategoryDetail,
    pub furniture: CategoryDetail,
    pub food: CategoryDetail,
    pub books: CategoryDetail,
    pub tools: CategoryDetail,
    pub toys: CategoryDetail,
    pub misc: CategoryDetail,
}

#[derive(SpacetimeType)]
pub struct ModelAccuracy {
    pub total_processed: u32,
    pub rejection_rate_pct: f64,
    pub category_accuracy_pct: f64,
    pub avg_count_delta_pct: f64,
    pub avg_value_delta_pct: f64,
}

#[derive(SpacetimeType)]
pub struct EmployeeStat {
    pub name: String,
    pub items_handled: u32,
}
