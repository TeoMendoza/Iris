use spacetimedb::{Identity, SpacetimeType, Timestamp, table};
use crate::*;

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

#[table(accessor = unprocessed_image, public)]
pub struct UnprocessedImage {
    #[primary_key] #[auto_inc] pub id: u64,
    pub image_bytes: Vec<u8>,
}

#[table(accessor = processing_image, public)]
pub struct ProcessingImage {
    #[primary_key] #[auto_inc] pub id: u64,
    pub image_bytes: Vec<u8>,
    pub claimed_at: Timestamp,
    pub claimed_by: Identity,
}

#[table(accessor = processed_image, public, index(accessor = processed_by_company, btree(columns = [company_id])))]
pub struct ProcessedImage {
    #[primary_key] #[auto_inc] pub id: u64,
    pub company_id: u64,
    pub image_bytes: Vec<u8>,
    pub predicted_category: Category,
    pub predicted_condition: Condition,
    pub predicted_price: f64,
}

#[table(accessor = item_information, public,
    index(accessor = item_info_by_company, btree(columns = [company_id])),
    index(accessor = item_info_by_confirmer, btree(columns = [confirmed_by])))]
pub struct ItemInformation {
    #[primary_key] #[auto_inc] pub id: u64,
    pub processed_image_id: u64,
    pub company_id: u64,
    pub confirmed_by: Identity,
    pub image_bytes: Vec<u8>,
    pub category: Category,
    pub condition: Condition,
    pub estimated_price: f64,
}

#[table(accessor = item_classification, public, index(accessor = item_class_by_company, btree(columns = [company_id])))]
pub struct ItemClassification {
    #[primary_key] #[auto_inc] pub id: u64,
    #[unique] pub item_information_id: u64,
    pub company_id: u64,
    pub predicted_category: Category,
    pub predicted_condition: Condition,
    pub predicted_price: f64,
}

#[table(accessor = inventory_item, public, index(accessor = inventory_by_company, btree(columns = [company_id])))]
pub struct InventoryItem {
    #[primary_key] #[auto_inc] pub id: u64,
    #[unique] pub item_information_id: u64,
    pub company_id: u64,
    pub image_bytes: Vec<u8>,
    pub status: Status,
    pub price: f64,
}


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

#[derive(SpacetimeType, Clone)]
pub enum Condition {
    New,
    LikeNew,
    Good,
    Fair,
    Poor,
}

#[derive(SpacetimeType, Clone)]
pub enum Status {
    Sold,
    Shelf,
    Storage,
}

// ── Analytics types ──────────────────────────────────────

#[derive(SpacetimeType)]
pub struct ZoneStat {
    pub count: u32,
    pub value: f64,
    pub top_categories: Vec<Category>,
}

#[derive(SpacetimeType)]
pub struct AnalyticsOverview {
    pub total_employees: u32,
    pub pending_review: u32,
    pub shelf: ZoneStat,
    pub storage: ZoneStat,
    pub sold: ZoneStat,
}

#[derive(SpacetimeType)]
pub struct CategoryDetail {
    pub count: u32,
    pub total_value: f64,
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
    pub total_classified: u32,
    pub category_accuracy_pct: f64,
    pub avg_price_delta_pct: f64,
}

#[derive(SpacetimeType)]
pub struct EmployeeStat {
    pub name: String,
    pub items_handled: u32,
}
