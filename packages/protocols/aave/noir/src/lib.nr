mod core {
    mod deposit;
    mod withdraw;
}

mod modules {
    mod borrow;
    mod repay;
}

pub fn enable_borrow() -> bool {
    modules::borrow::is_module_enabled()
}

pub fn enable_repay() -> bool {
    modules::repay::is_module_enabled()
}
