use spacetimedb::{reducer, ReducerContext, Table};
use rand::RngCore;
use crate::*;

#[reducer(init)]
pub fn init(_ctx: &ReducerContext) {}

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
pub fn identity_disconnected(_ctx: &ReducerContext) {

}

#[reducer]
pub fn create_company(ctx: &ReducerContext, name: String) -> Result<(), String> {
    if ctx.db.user().id().find(ctx.sender()).is_none() {
        return Err("User not found".to_string());
    }

    if ctx.db.employee().id().find(ctx.sender()).is_some() {
        return Err("Already in a company".to_string());
    }

    let code = format!("{:016X}", ctx.rng().next_u64());
    let company = ctx.db.company().insert(Company { id: 0, name, code });
    ctx.db.employee().insert(Employee { id: ctx.sender(), company_id: company.id });
    Ok(())
}

#[reducer]
pub fn join_company(ctx: &ReducerContext, code: String) -> Result<(), String> {
    if ctx.db.user().id().find(ctx.sender()).is_none() {
        return Err("User not found".to_string());
    }
    if ctx.db.employee().id().find(ctx.sender()).is_some() {
        return Err("Already in a company".to_string());
    }
    let company = ctx.db.company().code().find(&code).ok_or("Company not found")?;
    ctx.db.employee().insert(Employee { id: ctx.sender(), company_id: company.id });
    Ok(())
}
