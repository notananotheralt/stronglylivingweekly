use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
};
use tauri::{Emitter, Manager};

#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;

const SUMMARY_SCHEMA: &str = "stronglylivingweekly.summary.v1";
const TOTAL_WEEKS: u16 = 4_160;
const MAX_BACKUP_BYTES: usize = 64 * 1024 * 1024;
const MAX_THEME_BYTES: u64 = 512 * 1024;
const MAX_TIMELINE_SEED_BYTES: u64 = 128 * 1024;
static WRITE_SEQUENCE: AtomicU64 = AtomicU64::new(0);
static WIDGET_POPOUT_MODE: AtomicBool = AtomicBool::new(false);
static WIDGET_DISMISS_ARMED: AtomicBool = AtomicBool::new(false);

struct DesktopThemeWatcher {
    _watcher: RecommendedWatcher,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DesktopSummaryTheme {
    surface: String,
    text: String,
    accent: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopAppTheme {
    canvas: String,
    surface: String,
    text: String,
    muted: String,
    elapsed: String,
    future: String,
    recorded: String,
    current: String,
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
    last_on_time_review_week_start: Option<String>,
    privacy_mode: String,
    commitment: Option<String>,
    commitment_valid_through: Option<String>,
    theme: DesktopSummaryTheme,
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
        || summary
            .last_on_time_review_week_start
            .as_deref()
            .is_some_and(|date| !is_iso_date(date))
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

fn cache_directory() -> Result<PathBuf, String> {
    if let Some(cache_home) = std::env::var_os("XDG_CACHE_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(cache_home));
    }

    std::env::var_os("HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .map(|home| home.join(".cache"))
        .ok_or_else(|| "Neither XDG_CACHE_HOME nor HOME is available.".to_string())
}

fn dms_state_directory() -> Result<PathBuf, String> {
    if let Some(state_home) = std::env::var_os("XDG_STATE_HOME").filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(state_home).join("DankMaterialShell"));
    }

    std::env::var_os("HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .map(|home| home.join(".local/state/DankMaterialShell"))
        .ok_or_else(|| "Neither XDG_STATE_HOME nor HOME is available.".to_string())
}

fn start_desktop_theme_watcher(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let palette_path = cache_directory()?.join("DankMaterialShell/dms-colors.json");
    let session_path = dms_state_directory()?.join("session.json");
    let watched_paths = [palette_path, session_path];
    let callback_paths = watched_paths.clone();
    let app_handle = app.handle().clone();

    let mut watcher = RecommendedWatcher::new(
        move |result: notify::Result<notify::Event>| {
            let Ok(event) = result else {
                return;
            };
            if event
                .paths
                .iter()
                .any(|path| callback_paths.iter().any(|target| target == path))
            {
                let _ = app_handle.emit("ricemood-theme-changed", ());
            }
        },
        Config::default(),
    )?;

    let mut watched_directories = HashSet::new();
    for path in watched_paths {
        if let Some(parent) = path.parent() {
            if watched_directories.insert(parent.to_path_buf()) {
                watcher.watch(parent, RecursiveMode::NonRecursive)?;
            }
        }
    }

    app.manage(DesktopThemeWatcher { _watcher: watcher });
    Ok(())
}

fn read_small_json(path: &Path) -> Result<Option<serde_json::Value>, String> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };

    if metadata.len() > MAX_THEME_BYTES {
        return Err("The desktop theme file is unexpectedly large.".into());
    }

    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents)
        .map(Some)
        .map_err(|_| "The desktop theme file is not valid JSON.".to_string())
}

fn dms_color(mode_colors: &serde_json::Value, key: &str) -> Result<String, String> {
    let color = mode_colors
        .get(key)
        .and_then(serde_json::Value::as_str)
        .filter(|color| is_hex_color(color))
        .ok_or_else(|| format!("The desktop theme is missing a valid {key} color."))?;

    Ok(color.to_string())
}

fn map_dms_theme(palette: &serde_json::Value, mode: &str) -> Result<DesktopAppTheme, String> {
    let mode_colors = palette
        .get("colors")
        .and_then(|colors| colors.get(mode))
        .ok_or_else(|| format!("The desktop theme has no {mode} palette."))?;

    Ok(DesktopAppTheme {
        canvas: dms_color(mode_colors, "surface")?,
        surface: dms_color(mode_colors, "surface_container_high")?,
        text: dms_color(mode_colors, "on_surface")?,
        muted: dms_color(mode_colors, "on_surface_variant")?,
        elapsed: dms_color(mode_colors, "surface_container_highest")?,
        future: dms_color(mode_colors, "surface_container_low")?,
        recorded: dms_color(mode_colors, "secondary")?,
        current: dms_color(mode_colors, "primary")?,
        accent: dms_color(mode_colors, "tertiary")?,
    })
}

#[tauri::command]
fn read_desktop_theme() -> Result<Option<DesktopAppTheme>, String> {
    let palette_path = cache_directory()?.join("DankMaterialShell/dms-colors.json");
    let Some(palette) = read_small_json(&palette_path)? else {
        return Ok(None);
    };

    let session_path = dms_state_directory()?.join("session.json");
    let light_mode = read_small_json(&session_path)?
        .and_then(|session| {
            session
                .get("isLightMode")
                .and_then(serde_json::Value::as_bool)
        })
        .unwrap_or(false);
    let mode = if light_mode { "light" } else { "dark" };

    map_dms_theme(&palette, mode).map(Some)
}

#[tauri::command]
fn read_timeline_seed() -> Result<Option<String>, String> {
    let path = state_directory()?.join("timeline-seed-v1.json");
    let metadata = match fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };

    if metadata.len() > MAX_TIMELINE_SEED_BYTES {
        return Err("The life chapter seed is unexpectedly large.".into());
    }

    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str::<serde_json::Value>(&contents)
        .map_err(|_| "The life chapter seed is not valid JSON.".to_string())?;

    Ok(Some(contents))
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

#[cfg(target_os = "linux")]
fn prefer_native_wayland() {
    if std::env::var_os("WAYLAND_DISPLAY").is_some_and(|value| !value.is_empty()) {
        std::env::set_var("GDK_BACKEND", "wayland");
    }
}

#[cfg(not(target_os = "linux"))]
fn prefer_native_wayland() {}

fn requests_window_toggle(arguments: &[String]) -> bool {
    arguments.iter().any(|argument| argument == "--toggle")
}

fn requests_window_hide(arguments: &[String]) -> bool {
    arguments.iter().any(|argument| argument == "--hide")
}

fn set_widget_popout_mode(enabled: bool) {
    WIDGET_POPOUT_MODE.store(enabled, Ordering::Relaxed);
    WIDGET_DISMISS_ARMED.store(false, Ordering::Relaxed);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    prefer_native_wayland();
    let initial_arguments = std::env::args().collect::<Vec<_>>();
    set_widget_popout_mode(requests_window_toggle(&initial_arguments));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(
            |app, arguments, _working_directory| {
                if let Some(window) = app.get_webview_window("main") {
                    if requests_window_hide(&arguments) {
                        set_widget_popout_mode(false);
                        let _ = window.hide();
                        return;
                    }

                    if requests_window_toggle(&arguments) && window.is_visible().unwrap_or(false) {
                        let _ = window.close();
                        return;
                    }

                    set_widget_popout_mode(requests_window_toggle(&arguments));
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            },
        ))
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            match event {
                tauri::WindowEvent::Focused(true) if WIDGET_POPOUT_MODE.load(Ordering::Relaxed) => {
                    WIDGET_DISMISS_ARMED.store(true, Ordering::Relaxed);
                }
                tauri::WindowEvent::Focused(false)
                    if WIDGET_POPOUT_MODE.load(Ordering::Relaxed)
                        && WIDGET_DISMISS_ARMED.swap(false, Ordering::Relaxed) =>
                {
                    WIDGET_POPOUT_MODE.store(false, Ordering::Relaxed);
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_desktop_theme,
            read_timeline_seed,
            write_desktop_summary,
            export_backup
        ])
        .setup(|app| {
            start_desktop_theme_watcher(app)?;
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
            last_on_time_review_week_start: Some("2026-08-03".into()),
            privacy_mode: privacy_mode.into(),
            commitment: None,
            commitment_valid_through: None,
            theme: DesktopSummaryTheme {
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

    #[test]
    fn maps_the_dms_palette_without_exposing_unrelated_state() {
        let palette = serde_json::json!({
            "colors": {
                "dark": {
                    "surface": "#101010",
                    "surface_container_high": "#202020",
                    "on_surface": "#f0f0f0",
                    "on_surface_variant": "#b0b0b0",
                    "surface_container_highest": "#303030",
                    "surface_container_low": "#181818",
                    "secondary": "#a0b0c0",
                    "primary": "#c0d0e0",
                    "tertiary": "#d0b080",
                    "private_note": "must not be projected"
                }
            }
        });

        let theme = map_dms_theme(&palette, "dark").expect("valid palette");
        assert_eq!(theme.canvas, "#101010");
        assert_eq!(theme.current, "#c0d0e0");
        assert_eq!(theme.accent, "#d0b080");
    }

    #[test]
    fn recognizes_only_the_explicit_window_toggle_argument() {
        assert!(requests_window_toggle(&["--toggle".into()]));
        assert!(requests_window_toggle(&[
            "/usr/bin/stronglylivingweekly".into(),
            "--toggle".into(),
        ]));
        assert!(!requests_window_toggle(&["--show".into()]));
    }

    #[test]
    fn recognizes_only_the_explicit_window_hide_argument() {
        assert!(requests_window_hide(&["--hide".into()]));
        assert!(!requests_window_hide(&["--toggle".into()]));
        assert!(!requests_window_hide(&["--hide-window-later".into()]));
    }
}
