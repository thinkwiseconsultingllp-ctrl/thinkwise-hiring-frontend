import "./StatusBadge.css";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    SENT: { label: "Sent", className: "badge--sent" },
    L1_SELECTED: { label: "L1 Selected", className: "badge--l1" },
    L2_SELECTED: { label: "L2 Selected", className: "badge--l2" },
    HR_ROUND: { label: "HR Round", className: "badge--l2" },
    SELECTED: { label: "Selected", className: "badge--selected" },
    REJECTED: { label: "Rejected", className: "badge--rejected" },
    OPEN: { label: "Open", className: "badge--open" },
    ON_HOLD: { label: "On Hold", className: "badge--hold" },
    CLOSED: { label: "Closed", className: "badge--closed" },
    POSITION_CLOSED: { label: "Position Closed", className: "badge--position-closed" },
    ARCHIVED: { label: "Archived", className: "badge--archived" },
    DELETED: { label: "Deleted", className: "badge--closed" },
};

interface Props {
    status: string;
}

export default function StatusBadge({ status }: Props) {
    const config = STATUS_CONFIG[status] || { label: status, className: "" };
    return (
        <span className={`status-badge ${config.className}`}>
            {config.label}
        </span>
    );
}
