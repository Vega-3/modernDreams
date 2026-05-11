//! OS-level system utilities exposed to the frontend.

/// Open the operating system's microphone privacy settings.
///
/// Each platform has its own mechanism:
/// - Windows  → Settings → Privacy & Security → Microphone (ms-settings URI)
/// - macOS    → System Settings → Privacy & Security → Microphone (apple URI)
/// - Linux    → GNOME Control Centre → Privacy → Microphone; falls back to
///              KDE System Settings, then pavucontrol as a last resort.
#[tauri::command]
pub fn open_microphone_settings() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "ms-settings:privacy-microphone"])
            .spawn()
            .map_err(|e| format!("Failed to open Windows Settings: {e}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
            .spawn()
            .map_err(|e| format!("Failed to open macOS System Settings: {e}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Trigger: GNOME is the default desktop on Ubuntu/Fedora/Debian.
        // Why: gnome-control-center opens directly to the Privacy panel.
        // Outcome: if spawn fails (desktop is not GNOME), try the next option.
        if std::process::Command::new("gnome-control-center")
            .arg("privacy")
            .spawn()
            .is_err()
        {
            // KDE Plasma — opens the PulseAudio/PipeWire device page.
            if std::process::Command::new("systemsettings5")
                .arg("kcm_pulseaudio")
                .spawn()
                .is_err()
            {
                // Generic fallback: PulseAudio Volume Control shows which apps
                // hold the microphone and lets the user mute/block them.
                std::process::Command::new("pavucontrol")
                    .spawn()
                    .map_err(|e| {
                        format!(
                            "Could not open microphone settings automatically ({e}). \
                             Please open your system Sound or Privacy settings manually."
                        )
                    })?;
            }
        }
    }

    Ok(())
}
