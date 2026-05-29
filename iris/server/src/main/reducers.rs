use spacetimedb::{reducer, ReducerContext, Table};
use rand::RngCore;
use crate::*;

const CLAIM_BATCH_SIZE: usize = 10;

#[reducer(init)]
pub fn init(ctx: &ReducerContext) {
    let code = format!("{:016x}", ctx.rng().next_u64());
    let vision_key = format!("{:016x}", ctx.rng().next_u64());
    ctx.db.company().insert(Company { id: 0, name: "iris-labs".to_string(), code, vision_key });
}

#[reducer(client_connected)]
pub fn identity_connected(_ctx: &ReducerContext) { }

#[reducer(client_disconnected)]
pub fn identity_disconnected(_ctx: &ReducerContext) { }

#[reducer]
pub fn create_user(ctx: &ReducerContext, name: String, email: String) -> Result<(), String> {
    if ctx.db.user().id().find(ctx.sender()).is_some() {
        return Err("User already exists".to_string());
    }
    ctx.db.user().insert(User { id: ctx.sender(), name, email });
    Ok(())
}

#[reducer]
pub fn join_company(ctx: &ReducerContext, code: String) -> Result<(), String> {
    ctx.db.user().id().find(ctx.sender()).ok_or("No user account")?;
    if ctx.db.employee().id().find(ctx.sender()).is_some() {
        return Err("Already in company".to_string());
    }
    ctx.db.company().code().find(&code.to_lowercase()).ok_or("Invalid code")?;
    ctx.db.employee().insert(Employee { id: ctx.sender() });
    Ok(())
}

#[reducer]
pub fn register_vision_client(ctx: &ReducerContext, key: String) -> Result<(), String> {
    let company = ctx.db.company().iter().next().ok_or("Company not found")?;
    if key.to_lowercase() != company.vision_key {
        return Err("Invalid key".to_string());
    }

    if ctx.db.vision_client().iter().next().is_some() {
        return Err("Vision client already registered".to_string());
    }

    ctx.db.vision_client().insert(VisionClient { identity: ctx.sender() });
    Ok(())
}

#[reducer]
pub fn claim_images(ctx: &ReducerContext) -> Result<(), String> {
    if ctx.db.vision_client().identity().find(ctx.sender()).is_none() {
        return Err("Unauthorized".to_string());
    }

    let batch: Vec<UnprocessedImage> = ctx.db.unprocessed_image().iter().take(CLAIM_BATCH_SIZE).collect();
    for image in batch {
        let id = image.id;
        ctx.db.unprocessed_image().id().delete(&id);
        ctx.db.processing_image().insert(ProcessingImage {
            id: 0,
            image_bytes: image.image_bytes,
            claimed_at: ctx.timestamp,
            claimed_by: ctx.sender(),
        });
    }
    Ok(())
}

#[reducer]
pub fn submit_processed_image(ctx: &ReducerContext, processing_id: u64, category: Category, color: Color, demographic: Demographic) -> Result<(), String> {
    if ctx.db.vision_client().identity().find(ctx.sender()).is_none() {
        return Err("Unauthorized".to_string());
    }

    let image = ctx.db.processing_image().id().find(processing_id).ok_or("Not found")?;
    if image.claimed_by != ctx.sender() {
        return Err("Unauthorized claim".to_string());
    }

    ctx.db.processing_image().id().delete(&processing_id);
    ctx.db.processed_image().insert(ProcessedImage {
        id: 0,
        image_bytes: image.image_bytes,
        predicted_category: category,
        predicted_color: color,
        predicted_demographic: demographic,
    });
    Ok(())
}

#[reducer]
pub fn confirm_processed_image(ctx: &ReducerContext, processed_image_id: u64, category: Category, color: Color, demographic: Demographic) -> Result<(), String> {
    ctx.db.employee().id().find(ctx.sender()).ok_or("Unauthorized")?;
    let processed = ctx.db.processed_image().id().find(processed_image_id).ok_or("Not found")?;
    let info = ctx.db.item_information().insert(ItemInformation {
        id: 0,
        processed_image_id,
        image_bytes: processed.image_bytes.clone(),
        category,
        color,
        demographic,
    });
    ctx.db.item_classification().insert(ItemClassification {
        id: 0,
        item_information_id: info.id,
        predicted_category: processed.predicted_category,
        predicted_color: processed.predicted_color,
        predicted_demographic: processed.predicted_demographic,
    });
    ctx.db.inventory_item().insert(InventoryItem {
        id: 0,
        item_information_id: info.id,
        image_bytes: processed.image_bytes,
        status: Status::Storage,
        price: 25.0,
    });
    ctx.db.processed_image().id().delete(&processed_image_id);
    Ok(())
}

#[reducer]
pub fn update_inventory_item(ctx: &ReducerContext, item_id: u64, status: Status, price: f64) -> Result<(), String> {
    ctx.db.employee().id().find(ctx.sender()).ok_or("Unauthorized")?;
    let item = ctx.db.inventory_item().id().find(item_id).ok_or("Not found")?;
    ctx.db.inventory_item().id().update(InventoryItem { status, price, ..item });
    Ok(())
}


#[reducer]
pub fn upload_image(ctx: &ReducerContext, image_bytes: Vec<u8>) -> Result<(), String> {
    ctx.db.employee().id().find(ctx.sender()).ok_or("Unauthorized")?;
    if image_bytes.is_empty() {
        return Err("image_bytes is empty".to_string());
    }
    ctx.db.unprocessed_image().insert(UnprocessedImage { id: 0, image_bytes });
    Ok(())
}

