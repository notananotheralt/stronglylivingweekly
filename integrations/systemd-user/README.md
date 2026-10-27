# Hourly Monday review reminders

This optional user timer reads only SLW's privacy-filtered desktop summary. It
runs hourly from 8:00 AM through 11:00 PM on Mondays and exits without showing
a notification once the previous week's review has been sealed.

Install it for the current user:

```bash
install -Dm755 stronglylivingweekly-reminder \
  "$HOME/.local/bin/stronglylivingweekly-reminder"
install -Dm644 stronglylivingweekly-reminder.service \
  "$HOME/.config/systemd/user/stronglylivingweekly-reminder.service"
install -Dm644 stronglylivingweekly-reminder.timer \
  "$HOME/.config/systemd/user/stronglylivingweekly-reminder.timer"
systemctl --user daemon-reload
systemctl --user enable --now stronglylivingweekly-reminder.timer
```

The notifier prefers `dms notify` and falls back to `notify-send`. It never
reads the journal database or includes private journal text in a notification.

To verify the decision logic without displaying a notification:

```bash
stronglylivingweekly-reminder --dry-run --now 2026-10-26T10:00:00
```
