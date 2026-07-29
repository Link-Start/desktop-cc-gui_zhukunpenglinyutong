//! 集成测试共享工具：唯一临时目录（禁止引入 tempfile，遵守零新增依赖）。

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// 测试结束自动清理的临时 DB 目录。
pub struct TempStoreDir {
    pub dir: PathBuf,
    pub db_path: PathBuf,
}

impl TempStoreDir {
    pub fn new(tag: &str) -> Self {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!(
            "mossx-shared-event-{tag}-{}-{nanos}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).expect("create temp store dir");
        Self {
            db_path: dir.join("shared-events.db"),
            dir,
        }
    }
}

impl Drop for TempStoreDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}
