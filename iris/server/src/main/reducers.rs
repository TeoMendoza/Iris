use spacetimedb::{reducer, ReducerContext, ScheduleAt, TimeDuration, Table};
use rand::RngCore;
use crate::*;

const CLAIM_BATCH_SIZE: usize = 10;
const CLOCK_TICK_INTERVAL_MICROS: i64 = 5 * 60 * 1_000_000;

#[reducer(init)]
pub fn init(ctx: &ReducerContext) {
    let code = format!("{:016x}", ctx.rng().next_u64());
    let vision_key = format!("{:016x}", ctx.rng().next_u64());
    let company = ctx.db.company().insert(Company { id: 0, name: "iris-labs".to_string(), code, vision_key });

    for category in [
        Category::Clothing, Category::Footwear, Category::Electronics, Category::Furniture,
        Category::Food, Category::Books, Category::Tools, Category::Toys, Category::Misc,
    ] {
        ctx.db.inventory_category().insert(InventoryCategory {
            id: 0,
            company_id: company.id,
            category,
            shelf_count: 0,
            storage_count: 0,
            sold_count: 0,
            total_value: 0,
        });
    }

    ctx.db.clock().insert(Clock { id: 0, now: ctx.timestamp });
    ctx.db.clock_tick().insert(ClockTick {
        scheduled_id: 0,
        scheduled_at: ScheduleAt::Interval(TimeDuration::from_micros(CLOCK_TICK_INTERVAL_MICROS)),
    });
}

#[reducer]
pub fn tick_clock(ctx: &ReducerContext, _tick: ClockTick) {
    match ctx.db.clock().iter().next() {
        Some(existing) => { ctx.db.clock().id().update(Clock { now: ctx.timestamp, ..existing }); }
        None => { ctx.db.clock().insert(Clock { id: 0, now: ctx.timestamp }); }
    }
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
    let company = ctx.db.company().code().find(&code.to_lowercase()).ok_or("Invalid code")?;
    ctx.db.employee().insert(Employee { id: ctx.sender(), company_id: company.id });
    Ok(())
}

#[reducer]
pub fn register_vision_client(ctx: &ReducerContext, key: String) -> Result<(), String> {
    let company = ctx.db.company().iter().next().ok_or("Company not found")?;
    if key.to_lowercase() != company.vision_key {
        return Err("Invalid key".to_string());
    }
    if let Some(existing) = ctx.db.vision_client().iter().next() {
        ctx.db.vision_client().identity().delete(&existing.identity);
    }
    ctx.db.vision_client().insert(VisionClient { identity: ctx.sender() });
    Ok(())
}

#[reducer]
pub fn claim_photos(ctx: &ReducerContext) -> Result<(), String> {
    if ctx.db.vision_client().identity().find(ctx.sender()).is_none() {
        return Err("Unauthorized".to_string());
    }
    let batch: Vec<PendingPhoto> = ctx.db.pending_photo().iter().take(CLAIM_BATCH_SIZE).collect();
    for photo in batch {
        let id = photo.id;
        ctx.db.pending_photo().id().delete(&id);
        ctx.db.claimed_photo().insert(ClaimedPhoto {
            id: 0,
            image_bytes: photo.image_bytes,
            claimed_at: ctx.timestamp,
            claimed_by: ctx.sender(),
            uploaded_by: photo.uploaded_by,
        });
    }
    Ok(())
}

#[reducer]
pub fn submit_analysis(ctx: &ReducerContext, claimed_id: u64, detections: Vec<DetectionInput>) -> Result<(), String> {
    if ctx.db.vision_client().identity().find(ctx.sender()).is_none() {
        return Err("Unauthorized".to_string());
    }
    let company = ctx.db.company().iter().next().ok_or("Company not found")?;
    let photo = ctx.db.claimed_photo().id().find(claimed_id).ok_or("Not found")?;
    if photo.claimed_by != ctx.sender() {
        return Err("Unauthorized claim".to_string());
    }
    ctx.db.claimed_photo().id().delete(&claimed_id);
    for detection in detections {
        ctx.db.review_item().insert(ReviewItem {
            id: 0,
            scan_id: claimed_id,
            company_id: company.id,
            image_bytes: photo.image_bytes.clone(),
            predicted_category: detection.category,
            predicted_count: detection.count,
            predicted_total_value: detection.total_value,
            uploaded_by: photo.uploaded_by,
            was_branched: false,
        });
    }
    Ok(())
}

#[reducer]
pub fn approve_review_item(ctx: &ReducerContext, review_item_id: u64, category: Category, count: u32, total_value: u32) -> Result<(), String> {
    ctx.db.employee().id().find(ctx.sender()).ok_or("Unauthorized")?;
    let item = ctx.db.review_item().id().find(review_item_id).ok_or("Not found")?;
    let company_id = item.company_id;
    let predicted_category = item.predicted_category.clone();
    let predicted_count = item.predicted_count;
    let predicted_total_value = item.predicted_total_value;
    let scan_id = item.scan_id;
    let uploaded_by = item.uploaded_by;
    let was_missed = item.was_branched;

    match ctx.db.inventory_category().category().find(&category) {
        Some(existing) => {
            ctx.db.inventory_category().id().update(InventoryCategory {
                storage_count: existing.storage_count + count,
                total_value: existing.total_value + total_value,
                ..existing
            });
        }
        None => {
            ctx.db.inventory_category().insert(InventoryCategory {
                id: 0,
                company_id,
                category: category.clone(),
                shelf_count: 0,
                storage_count: count,
                sold_count: 0,
                total_value,
            });
        }
    }

    ctx.db.stock_entry().insert(StockEntry {
        id: 0,
        company_id,
        category: category.clone(),
        items_added: count,
        value_at_scan: total_value,
        scanned_at: ctx.timestamp,
        confirmed_by: ctx.sender(),
    });

    ctx.db.prediction_log().insert(PredictionLog {
        id: 0,
        company_id,
        predicted_category,
        predicted_count,
        predicted_total_value,
        confirmed_category: category,
        confirmed_count: count,
        confirmed_total_value: total_value,
        was_rejected: false,
        was_missed,
        logged_at: ctx.timestamp,
        scan_id,
        uploaded_by,
        confirmed_by: ctx.sender(),
    });

    ctx.db.review_item().id().delete(&review_item_id);
    Ok(())
}

#[reducer]
pub fn reject_review_item(ctx: &ReducerContext, review_item_id: u64) -> Result<(), String> {
    ctx.db.employee().id().find(ctx.sender()).ok_or("Unauthorized")?;
    let item = ctx.db.review_item().id().find(review_item_id).ok_or("Not found")?;

    if !item.was_branched {
        ctx.db.prediction_log().insert(PredictionLog {
            id: 0,
            company_id: item.company_id,
            predicted_category: item.predicted_category.clone(),
            predicted_count: item.predicted_count,
            predicted_total_value: item.predicted_total_value,
            confirmed_category: item.predicted_category,
            confirmed_count: 0,
            confirmed_total_value: 0,
            was_rejected: true,
            was_missed: false,
            logged_at: ctx.timestamp,
            scan_id: item.scan_id,
            uploaded_by: item.uploaded_by,
            confirmed_by: ctx.sender(),
        });
    }

    ctx.db.review_item().id().delete(&review_item_id);
    Ok(())
}

#[reducer]
pub fn branch_review_item(ctx: &ReducerContext, source_review_item_id: u64) -> Result<(), String> {
    ctx.db.employee().id().find(ctx.sender()).ok_or("Unauthorized")?;
    let source = ctx.db.review_item().id().find(source_review_item_id).ok_or("Not found")?;
    let predicted_category = source.predicted_category.clone();
    let predicted_count = source.predicted_count;
    let predicted_total_value = source.predicted_total_value;

    ctx.db.review_item().insert(ReviewItem {
        id: 0,
        scan_id: source.scan_id,
        company_id: source.company_id,
        image_bytes: source.image_bytes,
        predicted_category,
        predicted_count,
        predicted_total_value,
        uploaded_by: source.uploaded_by,
        was_branched: true,
    });

    Ok(())
}

#[reducer]
pub fn move_stock(ctx: &ReducerContext, from_category: Category, from_status: Status, to_category: Category, to_status: Status, count: u32) -> Result<(), String> {
    ctx.db.employee().id().find(ctx.sender()).ok_or("Unauthorized")?;
    if from_category == to_category && from_status == to_status {
        return Err("Source and destination are the same".to_string());
    }
    let from_cat = ctx.db.inventory_category().category().find(&from_category).ok_or("Category not found")?;
    let company_id = from_cat.company_id;

    let from_count = match from_status {
        Status::Shelf   => from_cat.shelf_count,
        Status::Storage => from_cat.storage_count,
        Status::Sold    => from_cat.sold_count,
    };

    if count > from_count {
        return Err("Not enough items in that status".to_string());
    }

    let from_total = from_cat.shelf_count + from_cat.storage_count + from_cat.sold_count;
    let moved_value = if from_total > 0 {
        (((from_cat.total_value as f64 / from_total as f64) * count as f64).round() as u32).min(from_cat.total_value)
    } else {
        0
    };

    if from_category == to_category {
        let (shelf_count, storage_count, sold_count) = {
            let (mut s, mut st, mut so) = (from_cat.shelf_count, from_cat.storage_count, from_cat.sold_count);
            match from_status {
                Status::Shelf   => s  -= count,
                Status::Storage => st -= count,
                Status::Sold    => so -= count,
            }
            match to_status {
                Status::Shelf   => s  += count,
                Status::Storage => st += count,
                Status::Sold    => so += count,
            }
            (s, st, so)
        };
        ctx.db.inventory_category().id().update(InventoryCategory { shelf_count, storage_count, sold_count, ..from_cat });
    } else {
        let (shelf_count, storage_count, sold_count) = {
            let (mut s, mut st, mut so) = (from_cat.shelf_count, from_cat.storage_count, from_cat.sold_count);
            match from_status {
                Status::Shelf   => s  -= count,
                Status::Storage => st -= count,
                Status::Sold    => so -= count,
            }
            (s, st, so)
        };
        ctx.db.inventory_category().id().update(InventoryCategory {
            shelf_count,
            storage_count,
            sold_count,
            total_value: from_cat.total_value - moved_value,
            ..from_cat
        });

        match ctx.db.inventory_category().category().find(&to_category) {
            Some(existing) => {
                let (shelf_count, storage_count, sold_count) = {
                    let (mut s, mut st, mut so) = (existing.shelf_count, existing.storage_count, existing.sold_count);
                    match to_status {
                        Status::Shelf   => s  += count,
                        Status::Storage => st += count,
                        Status::Sold    => so += count,
                    }
                    (s, st, so)
                };
                ctx.db.inventory_category().id().update(InventoryCategory {
                    shelf_count,
                    storage_count,
                    sold_count,
                    total_value: existing.total_value + moved_value,
                    ..existing
                });
            }
            None => {
                let (shelf_count, storage_count, sold_count) = {
                    let (mut s, mut st, mut so) = (0u32, 0u32, 0u32);
                    match to_status {
                        Status::Shelf   => s  += count,
                        Status::Storage => st += count,
                        Status::Sold    => so += count,
                    }
                    (s, st, so)
                };
                ctx.db.inventory_category().insert(InventoryCategory {
                    id: 0,
                    company_id,
                    category: to_category.clone(),
                    shelf_count,
                    storage_count,
                    sold_count,
                    total_value: moved_value,
                });
            }
        }
    }

    ctx.db.stock_movement().insert(StockMovement {
        id: 0,
        company_id,
        from_category,
        to_category,
        from_status,
        to_status,
        count,
        moved_by: ctx.sender(),
        moved_at: ctx.timestamp,
    });

    Ok(())
}

#[reducer]
pub fn upload_photo(ctx: &ReducerContext, image_bytes: Vec<u8>) -> Result<(), String> {
    ctx.db.employee().id().find(ctx.sender()).ok_or("Unauthorized")?;
    if image_bytes.is_empty() {
        return Err("image_bytes is empty".to_string());
    }
    ctx.db.pending_photo().insert(PendingPhoto { id: 0, image_bytes, uploaded_by: ctx.sender() });
    Ok(())
}
