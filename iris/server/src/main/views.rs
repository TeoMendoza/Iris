use spacetimedb::{view, ViewContext, Query, Timestamp};
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

#[view(accessor = stock_movements, public)]
fn stock_movements_view(ctx: &ViewContext) -> impl Query<StockMovement> {
    let empty = ctx.from.stock_movement().r#where(|s| s.id.eq(u64::MAX));
    match ctx.db.employee().id().find(ctx.sender()) {
        Some(_) => ctx.from.stock_movement().r#where(|s| s.id.ne(0_u64)),
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

fn category_name(idx: usize) -> &'static str {
    match idx {
        0 => "Clothing",
        1 => "Footwear",
        2 => "Electronics",
        3 => "Furniture",
        4 => "Food",
        5 => "Books",
        6 => "Tools",
        7 => "Toys",
        _ => "Misc",
    }
}

// ── Time-window helpers ───────────────────────────────────
// Views have no access to "now" (no `ctx.timestamp`), so a scheduled reducer
// (`tick_clock`) periodically writes the current time into the `Clock` table.
// Windowed views read that as an approximation of "now" to compute cutoffs.

fn now(ctx: &ViewContext) -> Timestamp {
    ctx.db.clock().id().find(&1u64).map(|c| c.now).unwrap_or(Timestamp::UNIX_EPOCH)
}

fn cutoff(ctx: &ViewContext, days: u64) -> Timestamp {
    now(ctx) - std::time::Duration::from_secs(days * 86400)
}

// ── Analytics views (current-state snapshots, not time-filterable) ──

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
        let avg = cat.total_value as f64 / total as f64;
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
        shelf_value: shelf_value.round() as u32,
        storage_value: storage_value.round() as u32,
        sold_value: sold_value.round() as u32,
    })
}

#[view(accessor = category_breakdown, public)]
fn category_breakdown(ctx: &ViewContext) -> Option<CategoryBreakdown> {
    let company = ctx.db.company().id().find(&1u64)?;

    let mut cat_shelf   = [0u32; 9];
    let mut cat_storage = [0u32; 9];
    let mut cat_sold    = [0u32; 9];
    let mut cat_values  = [0u32; 9];
    let mut total_active_value = 0.0f64;

    for cat in ctx.db.inventory_category().inv_categories_by_company().filter(&company.id) {
        let idx = category_index(&cat.category);
        let total = cat.shelf_count + cat.storage_count + cat.sold_count;
        let avg = if total > 0 { cat.total_value as f64 / total as f64 } else { 0.0 };
        cat_shelf[idx]   = cat.shelf_count;
        cat_storage[idx] = cat.storage_count;
        cat_sold[idx]    = cat.sold_count;
        cat_values[idx]  = cat.total_value;
        total_active_value += avg * (cat.shelf_count + cat.storage_count) as f64;
    }

    let detail = |i: usize| {
        let total = cat_shelf[i] + cat_storage[i] + cat_sold[i];
        let avg = if total > 0 { cat_values[i] as f64 / total as f64 } else { 0.0 };
        let active_value = avg * (cat_shelf[i] + cat_storage[i]) as f64;
        let sell_through = if total > 0 { cat_sold[i] as f64 / total as f64 * 100.0 } else { 0.0 };
        let value_pct = if total_active_value > 0.0 { active_value / total_active_value * 100.0 } else { 0.0 };
        CategoryDetail {
            shelf_count: cat_shelf[i],
            storage_count: cat_storage[i],
            sold_count: cat_sold[i],
            total_value: cat_values[i],
            avg_item_value: avg.round() as u32,
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

// ── Model performance (windowed) ──────────────────────────

fn model_performance_impl(ctx: &ViewContext, cutoff: Option<Timestamp>) -> Option<ModelAccuracy> {
    let company = ctx.db.company().id().find(&1u64)?;

    let mut total = 0u32;
    let mut rejected = 0u32;
    let mut cat_matches = 0u32;
    let mut count_delta_sum = 0.0f64;
    let mut value_delta_sum = 0.0f64;
    let mut approved = 0u32;
    let mut missed = 0u32;

    for log in ctx.db.prediction_log().prediction_logs_by_company().filter(&company.id) {
        if let Some(c) = cutoff { if log.logged_at < c { continue; } }

        if log.was_missed {
            missed += 1;
            continue;
        }
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
        if log.confirmed_total_value > 0 {
            value_delta_sum += (log.predicted_total_value as f64 - log.confirmed_total_value as f64).abs()
                / log.confirmed_total_value as f64 * 100.0;
        }
    }

    Some(ModelAccuracy {
        total_processed: total,
        rejection_rate_pct: if total > 0 { rejected as f64 / total as f64 * 100.0 } else { 0.0 },
        category_accuracy_pct: if approved > 0 { cat_matches as f64 / approved as f64 * 100.0 } else { 0.0 },
        avg_count_delta_pct: if approved > 0 { count_delta_sum / approved as f64 } else { 0.0 },
        avg_value_delta_pct: if approved > 0 { value_delta_sum / approved as f64 } else { 0.0 },
        missed_count: missed,
        missed_rate_pct: if approved + missed > 0 { missed as f64 / (approved + missed) as f64 * 100.0 } else { 0.0 },
    })
}

#[view(accessor = model_performance_1y, public)]
fn model_performance_1y(ctx: &ViewContext) -> Option<ModelAccuracy> {
    model_performance_impl(ctx, Some(cutoff(ctx, 365)))
}

#[view(accessor = model_performance_3mo, public)]
fn model_performance_3mo(ctx: &ViewContext) -> Option<ModelAccuracy> {
    model_performance_impl(ctx, Some(cutoff(ctx, 90)))
}

#[view(accessor = model_performance_6mo, public)]
fn model_performance_6mo(ctx: &ViewContext) -> Option<ModelAccuracy> {
    model_performance_impl(ctx, Some(cutoff(ctx, 182)))
}

#[view(accessor = model_performance_all, public)]
fn model_performance_all(ctx: &ViewContext) -> Option<ModelAccuracy> {
    model_performance_impl(ctx, None)
}

// ── Employee activity (windowed) ──────────────────────────

fn employee_activity_impl(ctx: &ViewContext, cutoff: Option<Timestamp>) -> Vec<EmployeeActivity> {
    let Some(company) = ctx.db.company().id().find(&1u64) else { return vec![]; };

    let mut stats: Vec<EmployeeActivity> = ctx.db.employee().company_employees().filter(&company.id).map(|emp| {
        let name = ctx.db.user().id().find(&emp.id).map(|u| u.name).unwrap_or_else(|| "Unknown".to_string());

        let mut items_approved = 0u32;
        let mut cat_counts = [0u32; 9];
        for entry in ctx.db.stock_entry().stock_entries_by_confirmer().filter(&emp.id) {
            if let Some(c) = cutoff { if entry.scanned_at < c { continue; } }
            items_approved += 1;
            cat_counts[category_index(&entry.category)] += 1;
        }

        let mut scan_ids: std::collections::HashSet<u64> = std::collections::HashSet::new();
        let mut missed_items_reported = 0u32;
        for log in ctx.db.prediction_log().prediction_logs_by_company().filter(&company.id) {
            if let Some(c) = cutoff { if log.logged_at < c { continue; } }
            if log.uploaded_by == emp.id { scan_ids.insert(log.scan_id); }
            if log.was_missed && log.confirmed_by == emp.id { missed_items_reported += 1; }
        }

        let mut moves_performed = 0u32;
        for mv in ctx.db.stock_movement().stock_movements_by_mover().filter(&emp.id) {
            if let Some(c) = cutoff { if mv.moved_at < c { continue; } }
            moves_performed += 1;
        }

        let top_category = cat_counts.iter().enumerate()
            .max_by_key(|&(_, &c)| c)
            .filter(|&(_, &c)| c > 0)
            .map(|(i, _)| category_name(i).to_string());

        EmployeeActivity {
            identity: emp.id,
            name,
            items_approved,
            scans_submitted: scan_ids.len() as u32,
            moves_performed,
            missed_items_reported,
            top_category,
        }
    }).collect();

    stats.sort_unstable_by(|a, b| b.items_approved.cmp(&a.items_approved));
    stats
}

#[view(accessor = employee_activity_1y, public)]
fn employee_activity_1y(ctx: &ViewContext) -> Vec<EmployeeActivity> {
    employee_activity_impl(ctx, Some(cutoff(ctx, 365)))
}

#[view(accessor = employee_activity_3mo, public)]
fn employee_activity_3mo(ctx: &ViewContext) -> Vec<EmployeeActivity> {
    employee_activity_impl(ctx, Some(cutoff(ctx, 90)))
}

#[view(accessor = employee_activity_6mo, public)]
fn employee_activity_6mo(ctx: &ViewContext) -> Vec<EmployeeActivity> {
    employee_activity_impl(ctx, Some(cutoff(ctx, 182)))
}

#[view(accessor = employee_activity_all, public)]
fn employee_activity_all(ctx: &ViewContext) -> Vec<EmployeeActivity> {
    employee_activity_impl(ctx, None)
}

// ── Period stats: company-wide activity (windowed) ────────

fn period_stats_impl(ctx: &ViewContext, cutoff: Option<Timestamp>) -> Option<PeriodStats> {
    let company = ctx.db.company().id().find(&1u64)?;

    let mut items_added = 0u32;
    let mut items_added_value = 0.0f64;
    for entry in ctx.db.stock_entry().stock_entries_by_company().filter(&company.id) {
        if let Some(c) = cutoff { if entry.scanned_at < c { continue; } }
        items_added += entry.items_added;
        items_added_value += entry.value_at_scan as f64;
    }

    // Moves don't carry a value, so sold value is approximated using each
    // category's current average item value.
    let mut avg_value = [0.0f64; 9];
    for cat in ctx.db.inventory_category().inv_categories_by_company().filter(&company.id) {
        let total = cat.shelf_count + cat.storage_count + cat.sold_count;
        if total > 0 {
            avg_value[category_index(&cat.category)] = cat.total_value as f64 / total as f64;
        }
    }

    let mut items_sold = 0u32;
    let mut items_sold_value = 0.0f64;
    let mut moves_performed = 0u32;
    for mv in ctx.db.stock_movement().stock_movements_by_company().filter(&company.id) {
        if let Some(c) = cutoff { if mv.moved_at < c { continue; } }
        moves_performed += 1;
        if mv.to_status == Status::Sold {
            items_sold += mv.count;
            items_sold_value += avg_value[category_index(&mv.to_category)] * mv.count as f64;
        }
    }

    Some(PeriodStats {
        items_added,
        items_added_value: items_added_value.round() as u32,
        items_sold,
        items_sold_value: items_sold_value.round() as u32,
        moves_performed,
    })
}

#[view(accessor = period_stats_1y, public)]
fn period_stats_1y(ctx: &ViewContext) -> Option<PeriodStats> {
    period_stats_impl(ctx, Some(cutoff(ctx, 365)))
}

#[view(accessor = period_stats_3mo, public)]
fn period_stats_3mo(ctx: &ViewContext) -> Option<PeriodStats> {
    period_stats_impl(ctx, Some(cutoff(ctx, 90)))
}

#[view(accessor = period_stats_6mo, public)]
fn period_stats_6mo(ctx: &ViewContext) -> Option<PeriodStats> {
    period_stats_impl(ctx, Some(cutoff(ctx, 182)))
}

#[view(accessor = period_stats_all, public)]
fn period_stats_all(ctx: &ViewContext) -> Option<PeriodStats> {
    period_stats_impl(ctx, None)
}

// ── Category period breakdown: per-category activity (windowed) ──

fn category_period_breakdown_impl(ctx: &ViewContext, cutoff: Option<Timestamp>) -> Option<CategoryPeriodBreakdown> {
    let company = ctx.db.company().id().find(&1u64)?;

    let mut added_count = [0u32; 9];
    let mut added_value = [0.0f64; 9];
    for entry in ctx.db.stock_entry().stock_entries_by_company().filter(&company.id) {
        if let Some(c) = cutoff { if entry.scanned_at < c { continue; } }
        let idx = category_index(&entry.category);
        added_count[idx] += entry.items_added;
        added_value[idx] += entry.value_at_scan as f64;
    }

    let mut avg_value = [0.0f64; 9];
    for cat in ctx.db.inventory_category().inv_categories_by_company().filter(&company.id) {
        let total = cat.shelf_count + cat.storage_count + cat.sold_count;
        if total > 0 {
            avg_value[category_index(&cat.category)] = cat.total_value as f64 / total as f64;
        }
    }

    let mut sold_count = [0u32; 9];
    let mut sold_value = [0.0f64; 9];
    for mv in ctx.db.stock_movement().stock_movements_by_company().filter(&company.id) {
        if let Some(c) = cutoff { if mv.moved_at < c { continue; } }
        if mv.to_status == Status::Sold {
            let idx = category_index(&mv.to_category);
            sold_count[idx] += mv.count;
            sold_value[idx] += avg_value[idx] * mv.count as f64;
        }
    }

    let detail = |i: usize| CategoryPeriodDetail {
        items_added: added_count[i],
        items_added_value: added_value[i].round() as u32,
        items_sold: sold_count[i],
        items_sold_value: sold_value[i].round() as u32,
    };

    Some(CategoryPeriodBreakdown {
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

#[view(accessor = category_period_breakdown_1y, public)]
fn category_period_breakdown_1y(ctx: &ViewContext) -> Option<CategoryPeriodBreakdown> {
    category_period_breakdown_impl(ctx, Some(cutoff(ctx, 365)))
}

#[view(accessor = category_period_breakdown_3mo, public)]
fn category_period_breakdown_3mo(ctx: &ViewContext) -> Option<CategoryPeriodBreakdown> {
    category_period_breakdown_impl(ctx, Some(cutoff(ctx, 90)))
}

#[view(accessor = category_period_breakdown_6mo, public)]
fn category_period_breakdown_6mo(ctx: &ViewContext) -> Option<CategoryPeriodBreakdown> {
    category_period_breakdown_impl(ctx, Some(cutoff(ctx, 182)))
}

#[view(accessor = category_period_breakdown_all, public)]
fn category_period_breakdown_all(ctx: &ViewContext) -> Option<CategoryPeriodBreakdown> {
    category_period_breakdown_impl(ctx, None)
}
