//! Field-level encryption + searchable blind indexes (GUIDELINES.md §4).
//!
//! - AES-256-GCM with a random 96-bit nonce per value; blob = v1 || nonce || ct.
//! - Blind index = hex(HMAC-SHA256(idx_key, normalize(value)))[..32]; equality
//!   search hits a composite (tenant_id, *_bidx) btree index.

use aes_gcm::{aead::{Aead, KeyInit, OsRng}, AeadCore, Aes256Gcm, Key, Nonce};
use hmac::{Hmac, Mac};
use sha2::Sha256;

const VERSION: u8 = 1;

pub struct FieldCipher {
    cipher: Aes256Gcm,
    idx_key: Vec<u8>,
}

impl FieldCipher {
    pub fn from_config(cfg: &crate::config::Config) -> anyhow::Result<Self> {
        let enc = hex::decode(&cfg.enc_key_hex)?;
        let idx = hex::decode(&cfg.idx_key_hex)?;
        anyhow::ensure!(enc.len() == 32 && idx.len() == 32, "keys must be 32 bytes hex");
        anyhow::ensure!(enc != idx, "enc and idx keys must differ");
        Ok(Self {
            cipher: Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&enc)),
            idx_key: idx,
        })
    }

    pub fn encrypt(&self, plaintext: &str) -> anyhow::Result<Vec<u8>> {
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ct = self.cipher.encrypt(&nonce, plaintext.as_bytes())
            .map_err(|_| anyhow::anyhow!("encrypt failed"))?;
        let mut out = Vec::with_capacity(1 + 12 + ct.len());
        out.push(VERSION);
        out.extend_from_slice(&nonce);
        out.extend_from_slice(&ct);
        Ok(out)
    }

    pub fn decrypt(&self, blob: &[u8]) -> anyhow::Result<String> {
        anyhow::ensure!(blob.len() > 13 && blob[0] == VERSION, "bad ciphertext");
        let nonce = Nonce::from_slice(&blob[1..13]);
        let pt = self.cipher.decrypt(nonce, &blob[13..])
            .map_err(|_| anyhow::anyhow!("decrypt failed"))?;
        Ok(String::from_utf8(pt)?)
    }

    /// Deterministic blind index for equality search. Normalizes first.
    pub fn blind_index(&self, value: &str) -> String {
        let norm: String = value.to_lowercase().chars()
            .filter(|c| !c.is_whitespace() && *c != '+' && *c != '-')
            .collect();
        let mut mac = Hmac::<Sha256>::new_from_slice(&self.idx_key).expect("hmac key");
        mac.update(norm.as_bytes());
        hex::encode(mac.finalize().into_bytes())[..32].to_string()
    }

    /// Extra index variant for phone last-4 partial lookup.
    pub fn blind_index_last4(&self, phone: &str) -> String {
        let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
        let last4 = if digits.len() >= 4 { &digits[digits.len() - 4..] } else { &digits };
        self.blind_index(last4)
    }
}
