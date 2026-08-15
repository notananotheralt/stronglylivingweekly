import QtQuick
import Quickshell
import Quickshell.Io
import qs.Common
import qs.Widgets
import qs.Modules.Plugins

PluginComponent {
    id: root

    layerNamespacePlugin: "strongly-living-weekly"

    property var summary: null
    property bool summaryValid: false
    property string summaryError: "Open Strongly Living Weekly"

    readonly property string stateHome: Quickshell.env("XDG_STATE_HOME") || (Quickshell.env("HOME") + "/.local/state")
    readonly property string summaryPath: stateHome + "/stronglylivingweekly/summary-v1.json"
    readonly property int currentWeekNumber: deriveCurrentWeekNumber()
    readonly property int daysRemaining: deriveDaysRemaining()
    readonly property string currentCommitment: deriveCommitment()
    readonly property string weekText: summaryValid
        ? "Week " + currentWeekNumber + " / " + summary.totalWeeks + "  ·  " + daysRemaining + "d"
        : summaryError

    function isHexColor(value) {
        return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
    }

    function localDateFromISO(value) {
        const parts = value.split("-");
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }

    function localISO(date) {
        const year = String(date.getFullYear()).padStart(4, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
    }

    function validateSummary(value) {
        if (!value || value.schema !== "stronglylivingweekly.summary.v1")
            return false;
        if (!Number.isInteger(value.anchorWeekNumber) || value.anchorWeekNumber < 1 || value.anchorWeekNumber > 4160)
            return false;
        if (value.totalWeeks !== 4160 || value.weekStartsOn !== 1)
            return false;
        if (value.privacyMode !== "privacy" && value.privacyMode !== "personal")
            return false;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value.anchorWeekStart))
            return false;
        if (!value.theme || !isHexColor(value.theme.surface) || !isHexColor(value.theme.text) || !isHexColor(value.theme.accent))
            return false;
        if (value.privacyMode === "privacy" && (value.commitment !== null || value.commitmentValidThrough !== null))
            return false;
        return true;
    }

    function parseSummary() {
        try {
            const value = JSON.parse(summaryFile.text());
            if (!validateSummary(value))
                throw new Error("invalid summary schema");
            summary = value;
            summaryValid = true;
            summaryError = "";
        } catch (error) {
            summary = null;
            summaryValid = false;
            summaryError = "Open Strongly Living Weekly";
        }
    }

    function deriveCurrentWeekNumber() {
        const now = clock.date;
        if (!summaryValid || !now)
            return 0;
        const anchor = localDateFromISO(summary.anchorWeekStart);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const elapsedDays = Math.floor((today.getTime() - anchor.getTime()) / 86400000);
        const elapsedWeeks = Math.floor(elapsedDays / 7);
        return Math.max(1, Math.min(summary.totalWeeks, summary.anchorWeekNumber + elapsedWeeks));
    }

    function deriveDaysRemaining() {
        const now = clock.date;
        if (!summaryValid || !now)
            return 0;
        const anchor = localDateFromISO(summary.anchorWeekStart);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const elapsedDays = Math.floor((today.getTime() - anchor.getTime()) / 86400000);
        const elapsedWeeks = Math.floor(elapsedDays / 7);
        const nextWeek = new Date(anchor);
        nextWeek.setDate(nextWeek.getDate() + (elapsedWeeks + 1) * 7);
        return Math.max(0, Math.ceil((nextWeek.getTime() - now.getTime()) / 86400000));
    }

    function deriveCommitment() {
        const now = clock.date;
        if (!summaryValid || !now || summary.privacyMode !== "personal")
            return "";
        if (typeof summary.commitment !== "string" || typeof summary.commitmentValidThrough !== "string")
            return "";
        if (summary.commitmentValidThrough < localISO(now))
            return "";
        return summary.commitment.trim().slice(0, 120);
    }

    SystemClock {
        id: clock
        precision: SystemClock.Minutes
    }

    FileView {
        id: summaryFile
        path: root.summaryPath
        blockLoading: false
        preload: true
        watchChanges: true

        onLoaded: root.parseSummary()
        onFileChanged: reload()
        onLoadFailed: function(error) {
            root.summary = null;
            root.summaryValid = false;
            root.summaryError = "Open Strongly Living Weekly";
        }
    }

    Timer {
        interval: 60000
        running: true
        repeat: true
        onTriggered: summaryFile.reload()
    }

    pillClickAction: () => {
        Quickshell.execDetached(["stronglylivingweekly", "--show"]);
    }

    horizontalBarPill: Component {
        Row {
            spacing: Theme.spacingS

            DankIcon {
                name: "calendar_view_week"
                color: root.summaryValid ? root.summary.theme.accent : Theme.primary
                size: Theme.iconSize - 5
                anchors.verticalCenter: parent.verticalCenter
            }

            StyledText {
                text: root.weekText
                color: root.summaryValid ? root.summary.theme.text : Theme.surfaceText
                font.family: "JetBrains Mono"
                font.pixelSize: Theme.fontSizeSmall
                font.weight: Font.DemiBold
                anchors.verticalCenter: parent.verticalCenter
            }

            StyledText {
                visible: root.currentCommitment.length > 0
                width: Math.min(implicitWidth, 280)
                text: root.currentCommitment
                color: root.summaryValid ? root.summary.theme.accent : Theme.primary
                font.family: "JetBrains Mono"
                font.pixelSize: Theme.fontSizeSmall
                elide: Text.ElideRight
                anchors.verticalCenter: parent.verticalCenter
            }
        }
    }

    verticalBarPill: Component {
        Column {
            spacing: Theme.spacingXS

            DankIcon {
                name: "calendar_view_week"
                color: root.summaryValid ? root.summary.theme.accent : Theme.primary
                size: Theme.iconSize - 5
                anchors.horizontalCenter: parent.horizontalCenter
            }

            StyledText {
                text: root.summaryValid ? String(root.currentWeekNumber) : "Open"
                color: Theme.surfaceText
                font.family: "JetBrains Mono"
                font.pixelSize: Theme.fontSizeSmall
                anchors.horizontalCenter: parent.horizontalCenter
            }
        }
    }
}
