use spacetimedb::{reducer, ReducerContext, Table};
use rand::RngCore;
use crate::*;

const CLAIM_BATCH_SIZE: usize = 10;

#[reducer(init)]
pub fn init(ctx: &ReducerContext) {
    let code = format!("{:016X}", ctx.rng().next_u64());
    let vision_key = format!("{:016X}", ctx.rng().next_u64());
    ctx.db.company().insert(Company { id: 0, name: "iris-labs".to_string(), code, vision_key });
}

#[reducer(client_connected)]
pub fn identity_connected(ctx: &ReducerContext) {
    if ctx.db.user().id().find(ctx.sender()).is_none() {
        ctx.db.user().insert(User {
            id: ctx.sender(),
            name: ctx.sender().to_hex().to_string(),
            email: String::new(),
        });
    }
}

#[reducer(client_disconnected)]
pub fn identity_disconnected(_ctx: &ReducerContext) { }

#[reducer]
pub fn join_company(ctx: &ReducerContext, code: String) -> Result<(), String> {
    if ctx.db.user().id().find(ctx.sender()).is_none() {
        return Err("User not found".to_string());
    }

    if ctx.db.employee().id().find(ctx.sender()).is_some() {
        return Err("Already in company".to_string());
    }

    ctx.db.company().code().find(&code).ok_or("Invalid code")?;
    ctx.db.employee().insert(Employee { id: ctx.sender() });
    Ok(())
}

#[reducer]
pub fn register_vision_client(ctx: &ReducerContext, key: String) -> Result<(), String> {
    let company = ctx.db.company().iter().next().ok_or("Company not found")?;
    if key != company.vision_key {
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
