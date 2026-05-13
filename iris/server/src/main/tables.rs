use spacetimedb::{Identity, SpacetimeType, Timestamp, table};
use crate::*;

#[table(accessor = company, public)]
pub struct Company {
    #[primary_key] #[auto_inc] pub id: u64,
    pub name: String,
    #[unique] pub code: String
}

#[table(accessor = user, public)]
pub struct User {
    #[primary_key] pub id: Identity,
    pub name: String,
    pub email: String,
}

#[table(accessor = employee, public)]
pub struct Employee {
    #[primary_key] pub id: Identity,
    pub company_id: u64,
}

#[table(accessor = unprocessed_image, public)]
pub struct UnprocessedImage {
    #[primary_key] #[auto_inc] pub id: u64,
    pub company_id: u64,
    pub image_bytes: Vec<u8>,
}

#[table(accessor = processing_image, public)]
pub struct ProcessingImage {
    #[primary_key] #[auto_inc] pub id: u64,
    pub company_id: u64,
    pub image_bytes: Vec<u8>,
    pub claimed_at: Timestamp,
}

#[table(accessor = processed_image, public)]
pub struct ProcessedImage {
    #[primary_key] #[auto_inc] pub id: u64,
    pub company_id: u64,
    pub image_bytes: Vec<u8>,
    pub predicted_category: Category,
    pub predicted_color: Color,
    pub predicted_demographic: Demographic,
}

#[table(accessor = item_information, public)]
pub struct ItemInformation {
    #[primary_key] #[auto_inc] pub id: u64,
    pub company_id: u64,
    pub processed_image_id: u64,
    pub image_bytes: Vec<u8>,
    pub category: Category,
    pub color: Color,
    pub demographic: Demographic,
}

#[table(accessor = item_classification, public)]
pub struct ItemClassification {
    #[primary_key] #[auto_inc] pub id: u64,
    #[unique] pub item_information_id: u64,
    pub predicted_category: Category,
    pub predicted_color: Color,
    pub predicted_demographic: Demographic,
}

#[table(accessor = inventory_item, public)]
pub struct InventoryItem {
    #[primary_key] #[auto_inc] pub id: u64,
    #[unique] pub item_information_id: u64,
    pub status: Status,
    pub price: f64,
}


#[derive(SpacetimeType, Clone)]
pub enum Category {
    Shirts,
    Pants,
}

#[derive(SpacetimeType, Clone)]
pub enum Color {
    Red,
    Blue,
}

#[derive(SpacetimeType, Clone)]
pub enum Demographic {
    Mens,
    Womens,
}

#[derive(SpacetimeType, Clone)]
pub enum Status {
    Sold,
    Shelf,
    Storage,
}