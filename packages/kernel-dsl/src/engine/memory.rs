use std::collections::HashMap;
use crate::effect::MemValue;
use crate::parser::ast::{AssignOp, MemoryDomain, MemoryPath, Value};

pub struct MemoryStore {
    context:     HashMap<String, MemValue>,
    session:     HashMap<String, MemValue>,
    worksession: HashMap<String, MemValue>,
    user:        HashMap<String, MemValue>,
}

impl MemoryStore {
    pub fn new() -> Self {
        MemoryStore {
            context:     HashMap::new(),
            session:     HashMap::new(),
            worksession: HashMap::new(),
            user:        HashMap::new(),
        }
    }

    fn bucket(&self, domain: &MemoryDomain) -> &HashMap<String, MemValue> {
        match domain {
            MemoryDomain::Context     => &self.context,
            MemoryDomain::Session     => &self.session,
            MemoryDomain::WorkSession => &self.worksession,
            MemoryDomain::User        => &self.user,
        }
    }

    fn bucket_mut(&mut self, domain: &MemoryDomain) -> &mut HashMap<String, MemValue> {
        match domain {
            MemoryDomain::Context     => &mut self.context,
            MemoryDomain::Session     => &mut self.session,
            MemoryDomain::WorkSession => &mut self.worksession,
            MemoryDomain::User        => &mut self.user,
        }
    }

    pub fn get(&self, path: &MemoryPath) -> Option<&MemValue> {
        self.bucket(&path.domain).get(&path.key)
    }

    // Resolve a dotted path string (e.g. "session.name") to a MemValue.
    pub fn get_by_path(&self, path: &str) -> Option<&MemValue> {
        let (domain_str, key) = path.split_once('.')?;
        let domain = match domain_str {
            "context"     => MemoryDomain::Context,
            "session"     => MemoryDomain::Session,
            "worksession" => MemoryDomain::WorkSession,
            "user"        => MemoryDomain::User,
            _ => return None,
        };
        self.bucket(&domain).get(key)
    }

    pub fn set(&mut self, path: &MemoryPath, op: &AssignOp, value: MemValue) {
        let bucket = self.bucket_mut(&path.domain);
        let new_val = match op {
            AssignOp::Assign => value,
            AssignOp::AddAssign => {
                let existing = bucket.get(&path.key).cloned();
                match existing {
                    Some(e) => add_mem_values(&e, &value),
                    None    => value,
                }
            }
            AssignOp::SubAssign => {
                let existing = bucket.get(&path.key).cloned();
                match existing {
                    Some(e) => sub_mem_values(&e, &value),
                    None    => value,
                }
            }
        };
        bucket.insert(path.key.clone(), new_val);
    }

    pub fn set_raw(&mut self, domain: &str, key: &str, value: MemValue) {
        let domain = match domain {
            "context"     => MemoryDomain::Context,
            "session"     => MemoryDomain::Session,
            "worksession" => MemoryDomain::WorkSession,
            "user"        => MemoryDomain::User,
            _ => return,
        };
        self.bucket_mut(&domain).insert(key.to_string(), value);
    }

    pub fn clear_context(&mut self) {
        self.context.clear();
    }

    pub fn clear_worksession(&mut self) {
        self.worksession.clear();
    }

    // Resolve an AST Value to a MemValue, looking up paths in the store.
    pub fn resolve_value(&self, v: &Value) -> MemValue {
        match v {
            Value::Str(s)    => MemValue::Str(s.clone()),
            Value::Number(n) => MemValue::Num(*n),
            Value::Bool(b)   => MemValue::Bool(*b),
            Value::Null      => MemValue::Null,
            Value::Path(p)   => self
                .get_by_path(p)
                .cloned()
                .unwrap_or(MemValue::Null),
        }
    }

    // Serialize the full store to a JS-safe structure.
    // Returns a Vec of (domain, key, value) tuples since we can't easily
    // serialize nested HashMaps through wasm-bindgen without serde_json.
    pub fn snapshot(&self) -> StoreSnapshot {
        let mut entries = Vec::new();
        for (k, v) in &self.context {
            entries.push(MemEntry { domain: "context".into(), key: k.clone(), value: v.clone() });
        }
        for (k, v) in &self.session {
            entries.push(MemEntry { domain: "session".into(), key: k.clone(), value: v.clone() });
        }
        for (k, v) in &self.worksession {
            entries.push(MemEntry { domain: "worksession".into(), key: k.clone(), value: v.clone() });
        }
        for (k, v) in &self.user {
            entries.push(MemEntry { domain: "user".into(), key: k.clone(), value: v.clone() });
        }
        StoreSnapshot { entries }
    }
}

fn add_mem_values(a: &MemValue, b: &MemValue) -> MemValue {
    match (a, b) {
        (MemValue::Num(x), MemValue::Num(y))   => MemValue::Num(x + y),
        (MemValue::Str(x), MemValue::Str(y))   => MemValue::Str(format!("{}{}", x, y)),
        _ => b.clone(),
    }
}

fn sub_mem_values(a: &MemValue, b: &MemValue) -> MemValue {
    match (a, b) {
        (MemValue::Num(x), MemValue::Num(y)) => MemValue::Num(x - y),
        _ => b.clone(),
    }
}

#[derive(serde::Serialize)]
pub struct StoreSnapshot {
    pub entries: Vec<MemEntry>,
}

#[derive(serde::Serialize)]
pub struct MemEntry {
    pub domain: String,
    pub key:    String,
    pub value:  MemValue,
}
