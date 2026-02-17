mod privacy_flags;

mod core {
    mod stake;
    mod unstake;
}

mod modules {
    mod queue;
    mod yield;
}

pub fn enable_queue() -> bool {
    modules::queue::is_module_enabled()
}

pub fn enable_yield() -> bool {
    modules::yield::is_module_enabled()
}
