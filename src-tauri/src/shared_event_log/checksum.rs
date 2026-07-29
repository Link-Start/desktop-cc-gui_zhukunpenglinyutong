//! deterministic-json 序列化与 payload checksum。
//!
//! 契约（Foundation §14.4.4）：
//! `payload_checksum = SHA-256(UTF-8 deterministic-json(schemaVersion + factType + payload))`，
//! deterministic-json 必须固定 object key ordering、无空白、UTF-8，
//! number 走 serde_json 最短往返格式，不得依赖语言 Map 迭代顺序。

use serde_json::Value;
use sha2::{Digest, Sha256};

use super::error::StoreError;

/// 递归写入 deterministic JSON：object key 按字节序排序、无空白。
fn write_deterministic(value: &Value, out: &mut Vec<u8>) -> Result<(), StoreError> {
    match value {
        Value::Object(map) => {
            out.push(b'{');
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            for (index, key) in keys.iter().enumerate() {
                if index > 0 {
                    out.push(b',');
                }
                serde_json::to_writer(&mut *out, key).map_err(|source| {
                    StoreError::json("serialize deterministic json key", source)
                })?;
                out.push(b':');
                write_deterministic(&map[*key], out)?;
            }
            out.push(b'}');
        }
        Value::Array(items) => {
            out.push(b'[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(b',');
                }
                write_deterministic(item, out)?;
            }
            out.push(b']');
        }
        // Null / Bool / Number / String 直接走 serde_json 最短往返编码。
        leaf => serde_json::to_writer(&mut *out, leaf)
            .map_err(|source| StoreError::json("serialize deterministic json value", source))?,
    }
    Ok(())
}

/// 输出任意 JSON value 的 deterministic UTF-8 字节串。
pub fn deterministic_json_bytes(value: &Value) -> Result<Vec<u8>, StoreError> {
    let mut out = Vec::new();
    write_deterministic(value, &mut out)?;
    Ok(out)
}

/// 计算 `sha256:<hex>` 格式的 payload checksum。
///
/// 输入为 `(schemaVersion, factType, payload)` 三元组组成的 envelope object；
/// 由 writer 内部调用，调用方不得自行提供 checksum。
pub fn payload_checksum(
    schema_version: u32,
    fact_type: &str,
    payload: &Value,
) -> Result<String, StoreError> {
    let envelope = serde_json::json!({
        "schemaVersion": schema_version,
        "factType": fact_type,
        "payload": payload,
    });
    let bytes = deterministic_json_bytes(&envelope)?;
    let digest = Sha256::digest(&bytes);
    Ok(format!("sha256:{}", to_hex(&digest)))
}

/// 手写 hex 编码（基础格式化，非加密逻辑）。
fn to_hex(bytes: &[u8]) -> String {
    const HEX_DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX_DIGITS[(byte >> 4) as usize] as char);
        out.push(HEX_DIGITS[(byte & 0x0f) as usize] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn checksum_of_json_text(schema_version: u32, fact_type: &str, text: &str) -> String {
        let payload: Value = serde_json::from_str(text).expect("valid json payload");
        payload_checksum(schema_version, fact_type, &payload).expect("checksum")
    }

    #[test]
    fn deterministic_json_ignores_object_key_order() {
        let left = deterministic_json_bytes(&serde_json::json!({"b": 1, "a": 2})).expect("left");
        let right = deterministic_json_bytes(&serde_json::json!({"a": 2, "b": 1})).expect("right");
        assert_eq!(left, right);
        assert_eq!(String::from_utf8_lossy(&left), "{\"a\":2,\"b\":1}");
    }

    #[test]
    fn checksum_stable_across_whitespace_and_key_order() {
        let compact =
            checksum_of_json_text(1, "turn.userMessage", "{\"a\":1,\"b\":{\"y\":2,\"x\":3}}");
        let spaced = checksum_of_json_text(
            1,
            "turn.userMessage",
            "{\n  \"b\": { \"x\": 3, \"y\": 2 },\n  \"a\": 1\n}",
        );
        assert_eq!(compact, spaced);
    }

    #[test]
    fn deterministic_json_number_encoding_shortest_roundtrip() {
        // 同一 f64 值的不同文本写法归一化为最短往返格式。
        let left = checksum_of_json_text(1, "usage", "{\"v\": 1.00}");
        let right = checksum_of_json_text(1, "usage", "{\"v\": 1.0}");
        assert_eq!(left, right);

        let integer = deterministic_json_bytes(&serde_json::json!({"v": 100})).expect("int");
        assert_eq!(String::from_utf8_lossy(&integer), "{\"v\":100}");
    }

    #[test]
    fn checksum_carries_algorithm_prefix_and_changes_with_inputs() {
        let base = checksum_of_json_text(1, "turn.userMessage", "{\"a\":1}");
        assert!(base.starts_with("sha256:"));
        assert_eq!(base.len(), "sha256:".len() + 64);

        let other_fact = checksum_of_json_text(1, "turn.assistantMessage", "{\"a\":1}");
        let other_version = checksum_of_json_text(2, "turn.userMessage", "{\"a\":1}");
        assert_ne!(base, other_fact);
        assert_ne!(base, other_version);
    }
}
