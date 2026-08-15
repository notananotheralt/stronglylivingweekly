# Strongly Living Weekly capsule

This DankMaterialShell user plugin reads only
`$XDG_STATE_HOME/stronglylivingweekly/summary-v1.json` (or the standard
`~/.local/state` fallback). The native app owns that file and removes private
journal data before writing it.

The widget derives the current week after rollover, hides expired commitments,
and starts or focuses the native app when clicked. Missing or malformed state is
rendered as a neutral `Open Strongly Living Weekly` action.
