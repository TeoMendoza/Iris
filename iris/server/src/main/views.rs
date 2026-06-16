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

#[view(accessor = review_queue, public)]
fn review_queue(ctx: &ViewContext) -> impl Query<ReviewItem> {
    let empty = ctx.from.review_item().r#where(|r| r.id.eq(u64::MAX));
    match ctx.db.employee().id().find(ctx.sender()) {
        Some(_) => ctx.from.review_item().r#where(|r| r.id.ne(0_u64)),
        None => empty,
    }
}

#[view(accessor = inventory_categories, public)]
fn inventory_categories_view(ctx: &ViewContext) -> impl Query<InventoryCategory> {
    let empty = ctx.from.inventory_category().r#where(|c| c.id.eq(u64::MAX));
    match ctx.db.employee().id().find(ctx.sender()) {
        Some(_) => ctx.from.inventory_category().r#where(|c| c.id.ne(0_u64)),
        None => empty,
    }
}

#[view(accessor = stock_entries, public)]
fn stock_entries_view(ctx: &ViewContext) -> impl Query<StockEntry> {
    let empty = ctx.from.stock_entry().r#where(|s| s.id.eq(u64::MAX));
    match ctx.db.employee().id().find(ctx.sender()) {
        Some(_) => ctx.from.stock_entry().r#where(|s| s.id.ne(0_u64)),
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

// ── Analytics views ───────────────────────────────────────

#[view(accessor = analytics_overview, public)]
fn analytics_overview(ctx: &ViewContext) -> Option<AnalyticsOverview> {
    let company = ctx.db.company().id().find(&1u64)?;

    let total_employees = ctx.db.employee().company_employees().filter(&company.id).count() as u32;
    let pending_review = ctx.db.review_item().review_items_by_company().filter(&company.id).count() as u32;

    let mut shelf_count   = 0u32;
    let mut storage_count = 0u32;
    let mut sold_count    = 0u32;
    let mut shelf_value   = 0.0f64;
    let mut storage_value = 0.0f64;
    let mut sold_value    = 0.0f64;
    let mut active_categories = 0u32;

    for cat in ctx.db.inventory_category().inv_categories_by_company().filter(&company.id) {
        let total = cat.shelf_count + cat.storage_count + cat.sold_count;
        if total == 0 { continue; }
        active_categories += 1;
        let avg = cat.total_value / total as f64;
        shelf_count   += cat.shelf_count;
        storage_count += cat.storage_count;
        sold_count    += cat.sold_count;
        shelf_value   += avg * cat.shelf_count as f64;
        storage_value += avg * cat.storage_count as f64;
        sold_value    += avg * cat.sold_count as f64;
    }

    Some(AnalyticsOverview {
        total_employees,
        pending_review,
        active_categories,
        shelf_count,
        storage_count,
        sold_count,
        shelf_value,
        storage_value,
        sold_value,
    })
}

#[view(accessor = category_breakdown, public)]
fn category_breakdown(ctx: &ViewContext) -> Option<CategoryBreakdown> {
    let company = ctx.db.company().id().find(&1u64)?;

    let mut cat_shelf   = [0u32; 9];
    let mut cat_storage = [0u32; 9];
    let mut cat_sold    = [0u32; 9];
    let mut cat_values  = [0.0f64; 9];
    let mut total_active_value = 0.0f64;

    for cat in ctx.db.inventory_category().inv_categories_by_company().filter(&company.id) {
        let idx = category_index(&cat.category);
        let total = cat.shelf_count + cat.storage_count + cat.sold_count;
        let avg = if total > 0 { cat.total_value / total as f64 } else { 0.0 };
        cat_shelf[idx]   = cat.shelf_count;
        cat_storage[idx] = cat.storage_count;
        cat_sold[idx]    = cat.sold_count;
        cat_values[idx]  = cat.total_value;
        total_active_value += avg * (cat.shelf_count + cat.storage_count) as f64;
    }

    let detail = |i: usize| {
        let total = cat_shelf[i] + cat_storage[i] + cat_sold[i];
        let avg = if total > 0 { cat_values[i] / total as f64 } else { 0.0 };
        let active_value = avg * (cat_shelf[i] + cat_storage[i]) as f64;
        let sell_through = if total > 0 { cat_sold[i] as f64 / total as f64 * 100.0 } else { 0.0 };
        let value_pct = if total_active_value > 0.0 { active_value / total_active_value * 100.0 } else { 0.0 };
        CategoryDetail {
            shelf_count: cat_shelf[i],
            storage_count: cat_storage[i],
            sold_count: cat_sold[i],
            total_value: cat_values[i],
            avg_item_value: avg,
            sell_through_rate: sell_through,
            value_pct,
        }
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

    let mut total      = 0u32;
    let mut rejected   = 0u32;
    let mut cat_matches = 0u32;
    let mut count_delta_sum = 0.0f64;
    let mut value_delta_sum = 0.0f64;
    let mut approved   = 0u32;

    for log in ctx.db.prediction_log().prediction_logs_by_company().filter(&company.id) {
        total += 1;
        if log.was_rejected {
            rejected += 1;
            continue;
        }
        approved += 1;
        if log.predicted_category == log.confirmed_category {
            cat_matches += 1;
        }
        if log.confirmed_count > 0 {
            count_delta_sum += (log.predicted_count as f64 - log.confirmed_count as f64).abs()
                / log.confirmed_count as f64 * 100.0;
        }
        if log.confirmed_total_value > 0.0 {
            value_delta_sum += (log.predicted_total_value - log.confirmed_total_value).abs()
                / log.confirmed_total_value * 100.0;
        }
    }

    Some(ModelAccuracy {
        total_processed: total,
        rejection_rate_pct: if total > 0 { rejected as f64 / total as f64 * 100.0 } else { 0.0 },
        category_accuracy_pct: if approved > 0 { cat_matches as f64 / approved as f64 * 100.0 } else { 0.0 },
        avg_count_delta_pct: if approved > 0 { count_delta_sum / approved as f64 } else { 0.0 },
        avg_value_delta_pct: if approved > 0 { value_delta_sum / approved as f64 } else { 0.0 },
    })
}

#[view(accessor = employee_stats, public)]
fn employee_stats(ctx: &ViewContext) -> Vec<EmployeeStat> {
    let Some(company) = ctx.db.company().id().find(&1u64) else { return vec![]; };

    let mut stats: Vec<EmployeeStat> = ctx.db.employee().company_employees().filter(&company.id).map(|emp| {
        let name = ctx.db.user().id().find(&emp.id).map(|u| u.name).unwrap_or_else(|| "Unknown".to_string());
        let items_handled = ctx.db.stock_entry().stock_entries_by_confirmer().filter(&emp.id).count() as u32;
        EmployeeStat { name, items_handled }
    }).collect();

    stats.sort_unstable_by(|a, b| b.items_handled.cmp(&a.items_handled));
    stats
}
