mod core {
    mod swap;
}

mod modules {
    mod lp;
}

pub fn enable_lp() -> bool {
    modules::lp::is_module_enabled()
}
