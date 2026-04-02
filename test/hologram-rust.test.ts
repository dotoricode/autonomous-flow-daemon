import { describe, test, expect } from "bun:test";
import { generateHologram } from "../src/core/hologram";

describe("Rust Hologram Extractor", () => {

  test("RS: use declarations are preserved", async () => {
    const source = `use std::fmt;
use std::collections::HashMap;

pub fn main() {
  println!("hello");
}
`;
    const result = await generateHologram("main.rs", source);
    expect(result.hologram).toContain("use std::fmt");
    expect(result.hologram).toContain("use std::collections::HashMap");
    expect(result.language).toBe("rust");
  });

  test("RS: mod declarations are preserved", async () => {
    const source = `mod utils;
mod config {
  pub fn default() -> String {
    "default".to_string()
  }
}
`;
    const result = await generateHologram("lib.rs", source);
    expect(result.hologram).toContain("mod utils");
    expect(result.hologram).toContain("mod config");
    // Inline mod body should be stubbed
    expect(result.hologram).toContain("{…}");
    expect(result.hologram).not.toContain("default.to_string");
  });

  test("RS: struct with fields is extracted", async () => {
    const source = `pub struct Config {
    pub host: String,
    pub port: u16,
    enabled: bool,
}
`;
    const result = await generateHologram("config.rs", source);
    expect(result.hologram).toContain("pub struct Config");
    expect(result.hologram).toContain("host: String");
    expect(result.hologram).toContain("port: u16");
    expect(result.hologram).toContain("enabled: bool");
  });

  test("RS: enum with variants is extracted", async () => {
    const source = `pub enum Status {
    Active,
    Inactive,
    Error(String),
    Custom { code: u32, message: String },
}
`;
    const result = await generateHologram("status.rs", source);
    expect(result.hologram).toContain("pub enum Status");
    expect(result.hologram).toContain("Active");
    expect(result.hologram).toContain("Inactive");
    expect(result.hologram).toContain("Error(String)");
  });

  test("RS: trait with method signatures is extracted", async () => {
    const source = `pub trait Handler {
    fn handle(&self, req: &Request) -> Response;
    fn name(&self) -> &str;
}
`;
    const result = await generateHologram("handler.rs", source);
    expect(result.hologram).toContain("pub trait Handler");
    expect(result.hologram).toContain("fn handle");
    expect(result.hologram).toContain("fn name");
  });

  test("RS: type alias is preserved", async () => {
    const source = `pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
pub type Handler = fn(String) -> String;
`;
    const result = await generateHologram("types.rs", source);
    expect(result.hologram).toContain("pub type Result");
    expect(result.hologram).toContain("pub type Handler");
  });

  test("RS: impl block method bodies are stubbed", async () => {
    const source = `impl Config {
    pub fn new(host: String, port: u16) -> Self {
        Config { host, port, enabled: true }
    }
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }
}
`;
    const result = await generateHologram("config.rs", source);
    expect(result.hologram).toContain("impl Config");
    expect(result.hologram).toContain("fn new");
    expect(result.hologram).toContain("fn is_enabled");
    expect(result.hologram).toContain("{…}");
    expect(result.hologram).not.toContain("Config { host, port, enabled: true }");
    expect(result.hologram).not.toContain("self.enabled");
  });

  test("RS: trait impl block is extracted with stubbed methods", async () => {
    const source = `impl Handler for MyHandler {
    fn handle(&self, req: &Request) -> Response {
        Response::ok()
    }
}
`;
    const result = await generateHologram("handler.rs", source);
    expect(result.hologram).toContain("impl Handler for MyHandler");
    expect(result.hologram).toContain("fn handle");
    expect(result.hologram).toContain("{…}");
    expect(result.hologram).not.toContain("Response::ok()");
  });

  test("RS: standalone function body is stubbed", async () => {
    const source = `pub fn parse_args(args: &[String]) -> Result<Config> {
    let host = args.get(0).cloned().unwrap_or_default();
    let port: u16 = args.get(1).map(|s| s.parse().unwrap_or(8080)).unwrap_or(8080);
    Ok(Config { host, port, enabled: true })
}
`;
    const result = await generateHologram("cli.rs", source);
    expect(result.hologram).toContain("pub fn parse_args");
    expect(result.hologram).toContain("{…}");
    expect(result.hologram).not.toContain("unwrap_or_default");
    expect(result.hologram).not.toContain("parse().unwrap_or");
  });

  test("RS: compression rate is >= 45% for implementation-heavy file", async () => {
    const source = `use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct Store {
    data: Arc<Mutex<HashMap<String, String>>>,
}

impl Store {
    pub fn new() -> Self {
        Store {
            data: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get(&self, key: &str) -> Option<String> {
        let guard = self.data.lock().unwrap();
        guard.get(key).cloned()
    }

    pub fn set(&self, key: String, value: String) {
        let mut guard = self.data.lock().unwrap();
        guard.insert(key, value);
    }

    pub fn delete(&self, key: &str) -> bool {
        let mut guard = self.data.lock().unwrap();
        guard.remove(key).is_some()
    }

    pub fn len(&self) -> usize {
        let guard = self.data.lock().unwrap();
        guard.len()
    }

    pub fn clear(&self) {
        let mut guard = self.data.lock().unwrap();
        guard.clear();
    }

    pub fn contains_key(&self, key: &str) -> bool {
        let guard = self.data.lock().unwrap();
        guard.contains_key(key)
    }
}
`;
    const result = await generateHologram("store.rs", source);
    expect(result.savings).toBeGreaterThanOrEqual(45);
    expect(result.hologram).toContain("impl Store");
    expect(result.hologram).not.toContain("HashMap::new()");
    expect(result.hologram).not.toContain("lock().unwrap()");
  });

  test("RS: .rs extension routes to rust extractor (not L0 fallback)", async () => {
    const source = `pub fn hello() -> String {
    "hello world, a long implementation string that would waste tokens if not compressed".to_string()
}
`;
    const result = await generateHologram("hello.rs", source);
    expect(result.language).toBe("rust");
    expect(result.hologram).toContain("{…}");
  });
});
