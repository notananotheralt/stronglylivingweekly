use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};
use tauri::Manager;

#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;

const SUMMARY_SCHEMA: &str = "stronglylivingweekly.summary.v1";
const TOTAL_WEEKS: u16 = 4_160;
const MAX_BACKUP_BYTES: usize = 64 * 1024 * 1024;
static WRITE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DesktopTheme {
    surface: String,
    text: String,
    accent: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DesktopSummary {
    schema: String,
    generated_at: String,
    anchor_week_start: String,
    anchor_week_number: u16,
    total_weeks: u16,
    week_starts_on: u8,
    recorded_weeks: u16,
    privacy_mode: String,
    commitment: Option<String>,
    commitment_valid_through: Option<String>,
    theme: DesktopTheme,
}

fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || !bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit())
    {
        return false;
    }

    let Ok(year) = value[0..4].parse::<u16>() else {
        return false;
    };
    let Ok(month) = value[5..7].parse::<u8>() else {
        return false;
    };
    let Ok(day) = value[8..10].parse::<u8>() else {
        return false;
    };
    let leap_year =
        year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400));
    let days_in_month = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap_year => 29,
        2 => 28,
        _ => return false,
    };

    day >= 1 && day <= days_in_month
}

fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}

fn validate_summary(summary: &DesktopSummary) -> Result<(), String> {
    if summary.schema != SUMMARY_SCHEMA
        || summary.total_weeks != TOTAL_WEEKS
        || summary.week_starts_on != 1
        || !(1..=TOTAL_WEEKS).contains(&summary.anchor_week_number)
        || summary.recorded_weeks > TOTAL_WEEKS
        || !is_iso_date(&summary.anchor_week_start)
        || summary.generated_at.len() > 64
        || !summary.generated_at.contains('T')
    {
        return Err("The desktop summary has invalid calendar metadata.".into());
    }

    if !is_hex_color(&summary.theme.surface)
        || !is_hex_color(&summary.theme.text)
        || !is_hex_color(&summary.theme.accent)
    {
        return Err("The desktop summary contains an invalid theme color.".into());
    }

    match summary.privacy_mode.as_str() {
        "privacy" if summary.commitment.is_none() && summary.commitment_valid_through.is_none() => {
        }
        "personal" => match (&summary.commitment, &summary.commitment_valid_through) {
            (None, None) => {}
            (Some(commitment), Some(valid_through))
                if !commitment.trim().is_empty()
                    && commitment.chars().count() <= 1_000
                    && is_iso_date(valid_through) => {}
            _ => return Err("The desktop summary has inconsistent commitment data.".into()),
        },
        _ => return Err("The desktop summary has an invalid privacy projection.".into()),
    }

    Ok(())
}

fn atomic_write(path: &Path, contents: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .ok_or_else(|| "The destination has no parent directory.".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "The destination has an invalid file name.".to_string())?;
    let sequence = WRITE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let temporary = parent.join(format!(
        ".{file_name}.{}.{}.tmp",
        std::process::id(),
        sequence
    ));

    let result = (|| -> Result<(), std::io::Error> {
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        options.mode(0o600);
        let mut file = options.open(&temporary)?;
        file.write_all(contents)?;
        file.sync_all()?;
        fs::rename(&temporary, path)?;
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }

    result.map_err(|error| error.to_string())
}

fn state_directory() -> Result<PathBuf, String> {
    if let Some(state_home) = std::env::var_os("XDG_STATE_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(state_home).join("stronglylivingweekly"));
    }

    std::env::var_os("HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .map(|home| home.join(".local/state/stronglylivingweekly"))
        .ok_or_else(|| "Neither XDG_STATE_HOME nor HOME is available.".to_string())
}

#[tauri::command]
fn write_desktop_summary(summary: DesktopSummary) -> Result<(), String> {
    validate_summary(&summary)?;
    let mut contents = serde_json::to_vec_pretty(&summary).map_err(|error| error.to_string())?;
    contents.push(b'\n');
    atomic_write(&state_directory()?.join("summary-v1.json"), &contents)
}

#[tauri::command]
fn export_backup(contents: String, path: String) -> Result<(), String> {
    if contents.len() > MAX_BACKUP_BYTES {
        return Err("The backup is too large to export.".into());
    }

    serde_json::from_str::<serde_json::Value>(&contents)
        .map_err(|_| "The backup is not valid JSON.".to_string())?;
    atomic_write(Path::new(&path), contents.as_bytes())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(
            |app, _arguments, _working_directory| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            },
        ))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            write_desktop_summary,
            export_backup
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Strongly Living Weekly");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_summary(privacy_mode: &str) -> DesktopSummary {
        DesktopSummary {
            schema: SUMMARY_SCHEMA.into(),
            generated_at: "2026-08-15T10:00:00Z".into(),
            anchor_week_start: "2026-08-10".into(),
            anchor_week_number: 970,
            total_weeks: TOTAL_WEEKS,
            week_starts_on: 1,
            recorded_weeks: 21,
            privacy_mode: privacy_mode.into(),
            commitment: None,
            commitment_valid_through: None,
            theme: DesktopTheme {
                surface: "#111714".into(),
                text: "#edf3ef".into(),
                accent: "#a8c7b5".into(),
            },
        }
    }

    #[test]
    fn validates_calendar_dates() {
        assert!(is_iso_date("2024-02-29"));
        assert!(!is_iso_date("2026-02-29"));
        assert!(!is_iso_date("2026-13-01"));
    }

    #[test]
    fn rejects_commitments_in_privacy_mode() {
        let mut summary = valid_summary("privacy");
        summary.commitment = Some("Private text".into());
        summary.commitment_valid_through = Some("2026-08-16".into());
        assert!(validate_summary(&summary).is_err());
    }

    #[test]
    fn accepts_sanitized_personal_summary() {
        let mut summary = valid_summary("personal");
        summary.commitment = Some("Ship the beta".into());
        summary.commitment_valid_through = Some("2026-08-16".into());
        assert!(validate_summary(&summary).is_ok());
    }
}
