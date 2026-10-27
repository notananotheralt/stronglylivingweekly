# Strongly Living Weekly capsule

This DankMaterialShell user plugin reads only
`$XDG_STATE_HOME/stronglylivingweekly/summary-v1.json` (or the standard
`~/.local/state` fallback). The native app owns that file and removes private
journal data before writing it.

The widget derives the current week after rollover and starts or focuses the
native app when clicked. Its compact bar label never includes commitment text.
An event-driven user timer sends privacy-safe reminders hourly from 8:00 AM
through 11:00 PM on Mondays while the previous week's review remains
incomplete. The timer reads only the same redacted summary; the shell plugin
does not poll or duplicate those notifications. Missing or malformed state is
rendered as a neutral `Open Strongly Living Weekly` action.
