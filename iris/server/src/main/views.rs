use spacetimedb::{view, ViewContext, Query};
use crate::*;

#[view(accessor = my_user, public)]
fn my_user(ctx: &ViewContext) -> impl Query<User> {
    let sender = ctx.sender();
    ctx.from.user().r#where(move |u| u.id.eq(sender))
}

#[view(accessor = my_employee, public)]
fn my_employee(ctx: &ViewContext) -> impl Query<Employee> {
    let sender = ctx.sender();
    ctx.from.employee().r#where(move |e| e.id.eq(sender))
}

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


// ── Category helpers ──────────────────────────────────────

fn category_index(cat: &Category) -> usize {
    match cat {
        Category::Clothing    => 0,
        Category::Footwear    => 1,
        Category::Electronics => 2,
        Category::Furniture   => 3,
        Category::Food        => 4,
        Category::Books       => 5,
        Category::Tools       => 6,
        Category::Toys        => 7,
        Category::Misc        => 8,
    }
}

fn category_from_index(i: usize) -> Category {
    match i {
        0 => Category::Clothing,
        1 => Category::Footwear,
        2 => Category::Electronics,
        3 => Category::Furniture,
        4 => Category::Food,
        5 => Category::Books,
        6 => Category::Tools,
        7 => Category::Toys,
        _ => Category::Misc,
    }
}

fn top_categories(counts: &[u32; 9]) -> Vec<Category> {
    let mut indexed: Vec<(usize, u32)> = counts.iter().enumerate().map(|(i, &c)| (i, c)).collect();
    indexed.sort_unstable_by(|a, b| b.1.cmp(&a.1));
    indexed.into_iter().filter(|(_, c)| *c > 0).take(3).map(|(i, _)| category_from_index(i)).collect()
}

// ── Analytics views ───────────────────────────────────────

#[view(accessor = analytics_overview, public)]
fn analytics_overview(ctx: &ViewContext) -> Option<AnalyticsOverview> {
    let company = ctx.db.company().id().find(&1u64)?;

    let total_employees = ctx.db.employee().company_employees().filter(&company.id).count() as u32;
    let pending_review = ctx.db.processed_image().processed_by_company().filter(&company.id).count() as u32;

    let mut shelf_counts = [0u32; 9];
    let mut storage_counts = [0u32; 9];
    let mut sold_counts = [0u32; 9];
    let mut shelf_value = 0.0f64;
    let mut storage_value = 0.0f64;
    let mut sold_value = 0.0f64;

    for item in ctx.db.inventory_item().inventory_by_company().filter(&company.id) {
        if let Some(info) = ctx.db.item_information().id().find(&item.item_information_id) {
            let idx = category_index(&info.category);
            match item.status {
                Status::Shelf   => { shelf_counts[idx]   += 1; shelf_value   += item.price; }
                Status::Storage => { storage_counts[idx] += 1; storage_value += item.price; }
                Status::Sold    => { sold_counts[idx]    += 1; sold_value    += item.price; }
            }
        }
    }

    Some(AnalyticsOverview {
        total_employees,
        pending_review,
        shelf:   ZoneStat { count: shelf_counts.iter().sum(),   value: shelf_value,   top_categories: top_categories(&shelf_counts) },
        storage: ZoneStat { count: storage_counts.iter().sum(), value: storage_value, top_categories: top_categories(&storage_counts) },
        sold:    ZoneStat { count: sold_counts.iter().sum(),    value: sold_value,    top_categories: top_categories(&sold_counts) },
    })
}

#[view(accessor = category_breakdown, public)]
fn category_breakdown(ctx: &ViewContext) -> Option<CategoryBreakdown> {
    let company = ctx.db.company().id().find(&1u64)?;

    let mut cat_counts = [0u32; 9];
    let mut cat_values = [0.0f64; 9];
    let mut total_value = 0.0f64;

    for item in ctx.db.inventory_item().inventory_by_company().filter(&company.id) {
        if let Some(info) = ctx.db.item_information().id().find(&item.item_information_id) {
            let idx = category_index(&info.category);
            cat_counts[idx] += 1;
            cat_values[idx] += item.price;
            total_value += item.price;
        }
    }

    let detail = |i: usize| CategoryDetail {
        count: cat_counts[i],
        total_value: cat_values[i],
        value_pct: if total_value > 0.0 { cat_values[i] / total_value * 100.0 } else { 0.0 },
    };

    Some(CategoryBreakdown {
        clothing:    detail(0),
        footwear:    detail(1),
        electronics: detail(2),
        furniture:   detail(3),
        food:        detail(4),
        books:       detail(5),
        tools:       detail(6),
        toys:        detail(7),
        misc:        detail(8),
    })
}

#[view(accessor = model_accuracy, public)]
fn model_accuracy(ctx: &ViewContext) -> Option<ModelAccuracy> {
    let company = ctx.db.company().id().find(&1u64)?;

    let mut total = 0u32;
    let mut category_matches = 0u32;
    let mut price_delta_pct_sum = 0.0f64;

    for classification in ctx.db.item_classification().item_class_by_company().filter(&company.id) {
        if let Some(info) = ctx.db.item_information().id().find(&classification.item_information_id) {
            total += 1;
            if classification.predicted_category == info.category {
                category_matches += 1;
            }
            if info.estimated_price > 0.0 {
                price_delta_pct_sum += (classification.predicted_price - info.estimated_price).abs()
                    / info.estimated_price * 100.0;
            }
        }
    }

    Some(ModelAccuracy {
        total_classified: total,
        category_accuracy_pct: if total > 0 { category_matches as f64 / total as f64 * 100.0 } else { 0.0 },
        avg_price_delta_pct: if total > 0 { price_delta_pct_sum / total as f64 } else { 0.0 },
    })
}

#[view(accessor = employee_stats, public)]
fn employee_stats(ctx: &ViewContext) -> Vec<EmployeeStat> {
    let Some(company) = ctx.db.company().id().find(&1u64) else { return vec![]; };

    let mut stats: Vec<EmployeeStat> = ctx.db.employee().company_employees().filter(&company.id).map(|emp| {
        let name = ctx.db.user().id().find(&emp.id).map(|u| u.name).unwrap_or_else(|| "Unknown".to_string());
        let items_handled = ctx.db.item_information().item_info_by_confirmer().filter(&emp.id).count() as u32;
        EmployeeStat { name, items_handled }
    }).collect();

    stats.sort_unstable_by(|a, b| b.items_handled.cmp(&a.items_handled));
    stats
}
