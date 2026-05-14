use spacetimedb::{view, ViewContext, Query};
use crate::*;

#[view(accessor = inventory_to_review, public)]
fn review_queue(ctx: &ViewContext) -> impl Query<ProcessedImage> {
    let empty = ctx.from.processed_image().r#where(|p| p.id.eq(u64::MAX));
    match ctx.db.employee().id().find(ctx.sender()) {
        Some(_) => ctx.from.processed_image().r#where(|p| p.id.ne(0_u64)),
        None => empty,
    }
}

#[view(accessor = inventory, public)]
fn inventory(ctx: &ViewContext) -> impl Query<InventoryItem> {
    let empty = ctx.from.inventory_item().r#where(|i| i.id.eq(u64::MAX));
    match ctx.db.employee().id().find(ctx.sender()) {
        Some(_) => ctx.from.inventory_item().r#where(|i| i.id.ne(0_u64)),
        None => empty,
    }
}
